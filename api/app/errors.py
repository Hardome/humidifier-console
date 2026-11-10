"""Application failures with stable, safe public codes."""


class ConfigurationError(Exception):
    def __init__(self, status: int, code: str) -> None:
        self.status = status
        self.code = code
        super().__init__(code)
