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
    "en-AU,en;q=0.9"
};

const http = axios.create({
  timeout: 30000,
  headers: HEADERS,
  maxRedirects: 10
});

app.get("/api/debug", async (req, res) => {

  try {

    const url =
      "https://www.bom.gov.au/qld/flood/networks/index.shtml";

    const response =
      await http.get(url);

    const $ =
      cheerio.load(response.data);

    const links = [];

    $("a").each((_, a) => {

      links.push({
        text:
          $(a).text().trim(),
        href:
          $(a).attr("href")
      });

    });

    res.json({
      title:
        $("title")
          .text()
          .trim(),
      count:
        links.length,
      sample:
        links.slice(0, 200)
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
    `Listening on ${PORT}`
  );
});
