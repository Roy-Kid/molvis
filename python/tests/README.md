# python/tests

| Lane | Path | Notes |
|------|------|-------|
| Unit | `tests/test_*.py` | Fakes preferred; collected by default |
| Integration | `tests/integration/` | Live WS / ffmpeg — `pytestmark = pytest.mark.integration` |

Run unit only:

```bash
pytest tests -m 'not integration'
```

Default `npm run test:python` still runs both lanes.

`__pycache__/`, `.pyc`, coverage output, and temporary media are generated
artifacts, not fixtures. Keep committed fixtures explicit and place them in a
named `fixtures/` directory next to the tests that own them.
