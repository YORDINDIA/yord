"""Logging configuration for migration scripts."""

import logging
import sys


def setup_logging(
    name: str = None,
    level: int = logging.INFO,
    log_file: str = None,
    format_str: str = None,
) -> logging.Logger:
    """Set up logging with console and optional file output.

    Args:
        name: Logger name (None for root logger)
        level: Logging level (default INFO)
        log_file: Optional file path for log output
        format_str: Custom format string

    Returns:
        logging.Logger: Configured logger instance
    """
    if format_str is None:
        format_str = '%(asctime)s - %(levelname)s - %(message)s'

    # Create handlers
    handlers = [logging.StreamHandler(sys.stdout)]

    if log_file:
        handlers.append(logging.FileHandler(log_file))

    # Configure logging
    logging.basicConfig(
        level=level,
        format=format_str,
        handlers=handlers,
    )

    logger = logging.getLogger(name)
    return logger


def get_logger(name: str = None) -> logging.Logger:
    """Get a logger instance.

    Args:
        name: Logger name (usually __name__)

    Returns:
        logging.Logger: Logger instance
    """
    return logging.getLogger(name)
