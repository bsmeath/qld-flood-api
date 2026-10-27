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
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language":
    "en-AU,en;q=0.9",
  Referer: "https://www.bom.gov.au/"
};

const ROOT =
  "https://www.bom.gov.au/qld/flood/rain_river.shtml";

const http = axios.create({
  timeout: 30000,
  headers: HEADERS,
  maxRedirects: 10
});

app.get("/api/status", async (req, res) => {
  res.json({
    status: "online"
  });
});

app.get("/api/discovery", async (req, res) => {

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

  const stationMap =
    new Map();

  for (const page of catchmentPages) {

    try {

      const r =
        await http.get(page);

      const $page =
        cheerio.load(r.data);

      $page("a").each(
        (_, link) => {

          const href =
            $page(link)
              .attr("href") || "";

          const text =
            $page(link)
              .text()
              .trim();

          const match =
            href.match(
              /\.([0-9]{6})\.plt\.shtml/i
            );

          if (!match) return;

          const id =
            match[1];

          stationMap.set(id, {
            id,
            name:
              text || id,
            url:
              new URL(
                href,
                page
              ).href,
            source:
              page
          });

        }
      );

    } catch (err) {

      console.log(
        page,
        err.message
      );

    }
  }

  res.json({
    catchments:
      catchmentPages.length,
    stations:
      stationMap.size,
    sample:
      [...stationMap.values()]
        .slice(0, 20)
  });

});

app.listen(PORT, () => {
  console.log(
    `Running on ${PORT}`
  );
});
