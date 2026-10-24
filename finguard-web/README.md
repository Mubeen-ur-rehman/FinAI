# FinGuard AI: Next.js + Firebase

Single-page analyst dashboard: Firebase Auth (login), Firestore (alerts, batches, audit log),
CSV upload, risk scoring (demo scorer or your FastAPI model), alert review, and a path map.

## 1. Firebase setup (10 minutes)

1. https://console.firebase.google.com -> **Add project**.
2. **Build -> Authentication -> Get started -> Email/Password -> Enable**.
3. **Build -> Firestore Database -> Create database** (production mode, pick a nearby region).
4. **Firestore -> Rules** -> paste the contents of `firestore.rules` -> **Publish**.
5. **Project settings -> General -> Your apps -> Web (</>)** -> register app -> copy the config values.

## 2. Run the app

```bash
npm install
cp .env.local.example .env.local     # Windows: copy .env.local.example .env.local
# paste your Firebase values into .env.local
npm run dev
```
Open http://localhost:3000, click **Create an account**, then go to **Upload -> Run demo data**.

## 3. Make yourself admin (optional)

Firestore -> `users` -> your document -> change `role` from `analyst` to `admin`.

## 4. Connect your real ML model (FastAPI)

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`, restart `npm run dev`, and add this
endpoint to `backend/main.py` (it reuses `score_df` from the earlier guide):

```python
from pydantic import BaseModel
from typing import List, Dict, Any

class Rows(BaseModel):
    rows: List[Dict[str, Any]]

@app.post("/score-batch")
def score_batch(payload: Rows):
    df = pd.DataFrame(payload.rows)
    scored = score_df(df)
    return {"results": scored[["fraud_prob", "anomaly_score"]].to_dict(orient="records")}
```
Rows are scored in the same order they were sent. CORS must allow `http://localhost:3000`
(change `allow_origins` in the FastAPI middleware).

## Notes
- The built-in demo scorer is a rule-based stand-in so the UI works today. Your FYP results (recall/precision)
  must come from the trained XGBoost model, not from this scorer.
- Only the top 500 alerts per upload are saved to Firestore (free-tier write limit is 20,000/day).
- Never put real customer data in Firebase for a university project.
