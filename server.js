import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

const http = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    "Accept-Language":
      "en-AU,en;q=0.9"
  }
});

app.get("/api/debug", async (req, res) => {
  try {
    const url =
      "https://www.bom.gov.au/qld/flood/brisbane.shtml";

    const response =
      await http.get(url);

    const $ =
      cheerio.load(response.data);

    const urls = [];

    $("a").each((_, a) => {
      const href =
        $(a).attr("href");

      if (!href) return;

      urls.push(href);
    });

    res.json({
      count: urls.length,
      urls
    });

  } catch (err) {

    res.status(500).json({
      status:
        err.response?.status,
      message:
        err.message
    });

  }
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
