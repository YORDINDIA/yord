"""Single retry-with-backoff helper shared by all migration scripts.

Contract for ``fn`` (one attempt, zero-arg callable):
- return any value on success (including a ``requests.Response``);
- return a ``requests.Response`` with status 429 to trigger a
  ``Retry-After``-respecting wait and another attempt;
- raise ``requests.RequestException`` to trigger exponential backoff + jitter.

Any other exception propagates immediately (never retried).
When attempts are exhausted the last ``RequestException`` is re-raised --
callers convert that to their own failure value (e.g. ``(None, None)``).
No new pip deps: stdlib + ``requests`` only.
"""

import logging
import random
import time

import requests

logger = logging.getLogger(__name__)

MAX_WAIT_SECONDS = 60


def _parse_retry_after(response: requests.Response | None, fallback: float) -> float:
    """Extract Retry-After seconds, falling back to the backoff value."""
    if response is not None:
        raw = response.headers.get("Retry-After")
        if raw is not None:
            try:
                return max(0.0, float(raw))
            except (TypeError, ValueError):
                logger.warning(f"Ignoring malformed Retry-After header: {raw!r}")
    return fallback


def _backoff(attempt: int, base_wait: float) -> float:
    """Exponential backoff with jitter, capped at MAX_WAIT_SECONDS."""
    return min(MAX_WAIT_SECONDS, base_wait * (2 ** (attempt - 1)) + random.uniform(0, 1))


def retry_with_backoff(fn, retry_limit: int = 5, base_wait: float = 2,
                       logger_: logging.Logger | None = None):
    """Call ``fn`` with retries. See module docstring for the ``fn`` contract."""
    log = logger_ or logger
    last_exc: Exception | None = None

    for attempt in range(1, retry_limit + 1):
        try:
            result = fn()
        except requests.RequestException as exc:
            last_exc = exc
            if attempt == retry_limit:
                break
            wait = _backoff(attempt, base_wait)
            # A 429 that raised (via raise_for_status) still honors Retry-After.
            resp = getattr(exc, "response", None)
            wait = _parse_retry_after(resp if isinstance(resp, requests.Response) else None, wait)
            log.warning(f"Attempt {attempt}/{retry_limit} failed ({exc}). Retrying in {wait:.1f}s...")
            time.sleep(wait)
            continue

        if isinstance(result, requests.Response) and result.status_code == 429:
            if attempt == retry_limit:
                # Re-raise as HTTPError so callers see a RequestException.
                result.raise_for_status()
            wait = _parse_retry_after(result, _backoff(attempt, base_wait))
            log.warning(f"Rate limited (429). Waiting {wait:.1f}s... (attempt {attempt}/{retry_limit})")
            time.sleep(wait)
            continue

        return result

    if last_exc is not None:
        raise last_exc
    raise requests.exceptions.RetryError(f"Exhausted {retry_limit} attempts without a result")
