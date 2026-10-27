import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

const ROOT =
  "https://www.bom.gov.au/qld/flood/rain_river.shtml";

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

app.get("/api/test-gauge", async (req, res) => {
  try {

    const response = await http.get(ROOT);

    res.json({
      success: true,
      status: response.status,
      bytes: response.data.length
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      status: err.response?.status,
      message: err.message
    });

  }
});

app.get("/api/discovery", async (req, res) => {

  try {

    const rootPage =
      await http.get(ROOT);

    const $ =
      cheerio.load(rootPage.data);

    const catchmentPages =
      [];

    $("a").each((_, a) => {

      const href =
        $(a).attr("href");

      if (!href) return;

      if (
        href.includes("/qld/flood/") &&
        href.endsWith(".shtml")
      ) {

        catchmentPages.push(
          new URL(
            href,
            ROOT
          ).href
        );
      }
    });

    res.json({
      catchments:
        catchmentPages.length,
      sample:
        catchmentPages.slice(0, 20)
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

app.get("/api/debug", async (req, res) => {

  try {

    const page =
      "https://www.bom.gov.au/qld/flood/brisbane.shtml";

    const response =
      await http.get(page);

    const $ =
      cheerio.load(response.data);

    const links =
      [];

    $("a").each((_, link) => {

      links.push({
        text:
          $(link)
            .text()
            .trim(),
        href:
          $(link)
            .attr("href")
      });

    });

    res.json({
      page,
      count:
        links.length,
      sample:
        links.slice(0, 100)
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
