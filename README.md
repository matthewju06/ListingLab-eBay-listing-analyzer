# ListingLab

A lightweight eBay listing explorer: search, filter by price range, visualize distributions, and export results.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-listing--lab.vercel.app-000?style=flat&logo=vercel&logoColor=white)](https://listing-lab.vercel.app/)
![Status](https://img.shields.io/badge/status-active-success?style=flat)
![Stack](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS%20%2B%20Flask-blue?style=flat)

---

## ✨ Features

- Search eBay listings with optional **min/max price**
- Instant **summary stats** (count, avg/median/min/max)
- Interactive charts (price distribution, new vs used, seller score scatter, time series)
- **Download CSV** for analysis
- **Search history** + **Dark/Light mode** (saved locally)

---

## 🚀 Live Demo

- https://listing-lab.vercel.app/

---

## 🧱 Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS + Chart.js (CDN)
- **Backend:** Python + Flask API (`/api/search`)
- **Deploy:** Vercel (static + API route)

---

## 🛠️ Run Locally

### 1) Prereqs
- Python 3.10+ recommended
- eBay API credentials (Client ID + Client Secret)

### 2) Environment variables

Create a `.env` (do **not** commit):

~~~bash
CLIENT_ID=your_ebay_client_id
CLIENT_SECRET=your_ebay_client_secret
~~~

### 3) Install + run

~~~bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

pip install flask requests python-dotenv
python api.py
~~~

Open: http://localhost:8000

---

## 🔌 API

### `POST /api/search`

**Request**
~~~json
{
  "query": "pokemon",
  "minPrice": "0",
  "maxPrice": "200"
}
~~~

**Response**
~~~json
{
  "itemSummaries": [
    {
      "title": "...",
      "price": { "value": "...", "currency": "USD" }
    }
  ]
}
~~~

---

## 🔒 Open-source safety (read this before going public)

If you make the repo public, keep it safe with these basics:

- ✅ Never commit secrets (keep `CLIENT_ID` / `CLIENT_SECRET` only in `.env` locally + Vercel env vars)
- ✅ Restrict CORS to your domain (avoid `*` in production)
- ✅ Add rate limiting on `/api/search` (prevents abuse)
- ✅ Consider simple caching for repeated queries

<details>
  <summary><b>Should I make this repo public?</b></summary>

**Usually yes**, if you're using it as a portfolio piece and you:
- keep secrets out of Git
- add basic abuse protection (CORS + rate limit)

**Keep it private** if:
- you don’t want others copying your implementation
- you don’t want to maintain safeguards / operational risk
</details>

---

## 🗺️ Roadmap

- Pagination + more filters (condition, category, shipping)
- Caching + rate limiting
- Better setup (requirements.txt / pyproject.toml)
- Optional auth for the API

---

## 📄 License

Pick one:
## License

Source-available (Non-Commercial / No-Redistribution / No-Public-Deployment). See [`LICENSE`](LICENSE).
