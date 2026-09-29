from dataclasses import dataclass, field
from time import perf_counter


@dataclass
class Step:
    step: str
    detail: str
    status: str
    t_ms: int
    ms: int
    data: dict = field(default_factory=dict)


class Recorder:
    """Execution record of one turn: what ran, how long it took and what it decided. Never model reasoning."""

    def __init__(self) -> None:
        self._start = perf_counter()
        self.steps: list[Step] = []

    def now(self) -> float:
        return perf_counter()

    def add(self, step: str, detail: str, status: str, since: float | None = None, **data) -> None:
        end = perf_counter()
        begin = since if since is not None else end
        self.steps.append(Step(step, detail, status, int((begin - self._start) * 1000), int((end - begin) * 1000), data))

    def ordered(self) -> list[Step]:
        """Tools record when they finish; sorting by start shows nested steps inside their tool."""
        return sorted(self.steps, key=lambda s: s.t_ms)

    @property
    def total_ms(self) -> int:
        return int((perf_counter() - self._start) * 1000)
