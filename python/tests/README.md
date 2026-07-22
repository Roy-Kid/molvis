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
