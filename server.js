import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language":
    "en-AU,en;q=0.9",
  "Referer":
    "https://www.bom.gov.au/"
};

const ROOT =
  "https://www.bom.gov.au/qld/flood/rain_river.shtml";

app.get("/api/status", (req, res) => {
  res.json({
    status: "online"
  });
});

app.get("/api/discovery", async (req, res) => {
  try {

    const response =
      await axios.get(ROOT, {
        headers: HEADERS,
        timeout: 30000
      });

    const $ = cheerio.load(response.data);

    const links = [];

    $("a").each((_, link) => {

      const href =
        $(link).attr("href");

      if (!href) return;

      if (href.endsWith(".shtml")) {
        links.push(
          new URL(
            href,
            ROOT
          ).href
        );
      }
    });

    res.json({
      count: links.length,
      sample: links.slice(0, 20)
    });

  } catch (err) {

    res.status(500).json({
      error: err.message,
      status:
        err.response?.status
    });

  }
});

app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
