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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
  }
});

app.get("/api/debug", async (req, res) => {

  try {

    const response =
      await http.get(
        "https://www.bom.gov.au/qld/flood/brisbane.shtml"
      );

    const $ =
      cheerio.load(response.data);

    const maps = [];

    $("area").each((_, area) => {

      maps.push({
        alt: $(area).attr("alt"),
        title: $(area).attr("title"),
        href: $(area).attr("href")
      });

    });

    res.json({
      count: maps.length,
      sample: maps.slice(0, 100)
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
