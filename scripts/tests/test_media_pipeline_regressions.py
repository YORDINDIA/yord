import importlib.util
import io
import sys
from pathlib import Path

import pytest
from PIL import Image

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))

from utils import r2_helpers  # noqa: E402


def test_product_upload_writes_original_and_all_loader_siblings(monkeypatch):
    uploads = []

    def fake_upload(key, data, content_type, **kwargs):
        uploads.append((key, data, content_type, kwargs))
        return f"https://media.example/{key}.webp", None

    monkeypatch.setattr(r2_helpers, "upload_image", fake_upload)
    source = io.BytesIO()
    Image.new("RGB", (1400, 700), "navy").save(source, format="PNG")

    url, error = r2_helpers.upload_product_image(
        "products/test-shirt/01", source.getvalue(), "image/png"
    )

    assert error is None
    base_key = uploads[0][0]
    assert base_key.startswith("products/test-shirt/01--")
    assert len(base_key.rsplit("--", 1)[1]) == 16
    assert url == f"https://media.example/{base_key}.webp"
    assert [item[0] for item in uploads] == [
        base_key,
        f"{base_key}-320",
        f"{base_key}-640",
        f"{base_key}-960",
        f"{base_key}-1280",
    ]
    assert all(
        item[3]["cache_control"] == r2_helpers.PRODUCT_MEDIA_CACHE_CONTROL
        for item in uploads
    )
    widths = []
    for _, data, _, _ in uploads:
        with Image.open(io.BytesIO(data)) as image:
            widths.append(image.width)
    assert widths == [1400, 320, 640, 960, 1280]


def test_failed_revision_upload_never_overwrites_the_live_product_keys(monkeypatch):
    attempted = []

    def fail_variant(key, _data, _content_type, **_kwargs):
        attempted.append(key)
        if key.endswith("-640"):
            return None, "injected sibling failure"
        return f"https://media.example/{key}.webp", None

    monkeypatch.setattr(r2_helpers, "upload_image", fail_variant)
    source = io.BytesIO()
    Image.new("RGB", (1400, 700), "orange").save(source, format="PNG")

    url, error = r2_helpers.upload_product_image(
        "products/test-shirt/01.webp", source.getvalue(), "image/png"
    )

    assert url is None
    assert error and "640px variant upload failed" in error
    assert attempted[0].startswith("products/test-shirt/01--")
    assert all("--" in key for key in attempted)
    assert "products/test-shirt/01.webp" not in attempted


def test_product_revision_key_is_repeatable_when_called_with_its_own_url(monkeypatch):
    uploads = []

    def fake_upload(key, _data, _content_type, **_kwargs):
        uploads.append(key)
        return f"https://media.example/{key}.webp", None

    monkeypatch.setattr(r2_helpers, "upload_image", fake_upload)
    source = io.BytesIO()
    Image.new("RGB", (120, 80), "navy").save(source, format="PNG")
    data = source.getvalue()

    first, first_error = r2_helpers.upload_product_image(
        "products/test-shirt/front.png", data, "image/png"
    )
    second, second_error = r2_helpers.upload_product_image(
        first.removeprefix("https://media.example/").removesuffix(".webp"),
        data,
        "image/png",
    )

    assert first_error is None
    assert second_error is None
    assert second == first
    assert uploads[0] == uploads[5]


def test_r2_detection_keeps_historical_r2_dev_urls(monkeypatch):
    monkeypatch.setenv("R2_PUBLIC_BASE_URL", "https://media.example/cdn")
    url = "https://pub-oldbucket.r2.dev/products/test-shirt/01.webp"

    assert r2_helpers.is_r2_url(url)
    assert r2_helpers.key_from_public_url(url) == "products/test-shirt/01.webp"


def test_avif_fallback_keeps_file_extension(monkeypatch):
    class FakeClient:
        def __init__(self):
            self.put = None

        def put_object(self, **kwargs):
            self.put = kwargs

    client = FakeClient()
    monkeypatch.setattr(r2_helpers, "configure_r2", lambda: client)
    monkeypatch.setattr(r2_helpers, "resolve_r2_bucket", lambda: "bucket")
    monkeypatch.setattr(
        r2_helpers, "resolve_r2_public_base_url", lambda: "https://media.example"
    )

    url, error = r2_helpers.upload_image(
        "products/test-shirt/01", b"not-decodable-avif", "image/avif"
    )

    assert error is None
    assert url == "https://media.example/products/test-shirt/01.avif"
    assert client.put["Key"] == "products/test-shirt/01.avif"
    assert client.put["ContentType"] == "image/avif"


def test_variant_backfill_fails_when_candidate_processing_fails(monkeypatch, tmp_path):
    import generate_image_variants as variants

    monkeypatch.setattr(variants, "get_supabase_client", lambda: object())
    monkeypatch.setattr(
        variants,
        "fetch_product_images",
        lambda _client: [{"id": 7, "product_id": 2, "storage_url": "https://r2/01.webp"}],
    )
    monkeypatch.setattr(variants, "candidate_key", lambda _url: "products/shirt/01.webp")
    monkeypatch.setattr(variants, "list_existing_keys", lambda: set())
    monkeypatch.setattr(
        variants,
        "process_image",
        lambda row, _keys, _execute: {
            "id": row["id"],
            "key": "products/shirt/01.webp",
            "errors": ["download failed"],
            "planned": [],
            "skipped": [],
        },
    )

    backfill = variants.VariantBackfill(
        execute=True,
        checkpoint_file=str(tmp_path / "checkpoint.json"),
    )
    backfill.error_log_file = tmp_path / "errors.json"

    with pytest.raises(RuntimeError, match="eligible product image"):
        backfill.run()


def test_multifile_metafield_names_are_url_unique(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    spec = importlib.util.spec_from_file_location(
        "migrate_all_media", SCRIPTS / "migrate_all_media.py"
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    first = module.metafield_file_stem(42, "https://cdn.shopify.com/files/a.png")
    second = module.metafield_file_stem(42, "https://cdn.shopify.com/files/b.png")

    assert first != second
    assert first.startswith("42-")
    assert second.startswith("42-")
