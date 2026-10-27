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

const http = axios.create({
  timeout: 30000,
  headers: HEADERS,
  maxRedirects: 10
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "online"
  });
});

app.get("/api/debug", async (req, res) => {

  try {

    const page =
      "https://www.bom.gov.au/qld/flood/brisbane.shtml";

    const response =
      await http.get(page);

    const $ =
      cheerio.load(response.data);

    const bodyText =
      $("body").text();

    const gaugeMatches =
      bodyText.match(
        /\d{6}/g
      ) || [];

    res.json({
      page,
      pageLength:
        bodyText.length,
      sixDigitNumbers:
        [...new Set(gaugeMatches)]
          .slice(0, 100),
      title:
        $("title")
          .text()
          .trim()
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
  console.log(
    `QLD Flood API listening on ${PORT}`
  );
});
