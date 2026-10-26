import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

let gaugeCache = [];
let lastRefresh = null;
let discoveredStations = [];

/*
 Queensland river height entry page
*/
const ROOT =
  "https://www.bom.gov.au/qld/flood/rain_river.shtml";

/*
 Status
*/

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    gauges: gaugeCache.length,
    discovered: discoveredStations.length,
    updated: lastRefresh
  });
});

/*
 Gauges
*/

app.get("/api/gauges", (req, res) => {
  res.json(gaugeCache);
});

app.get("/api/gauges/:id", (req, res) => {
  const gauge = gaugeCache.find(
    g => g.id === req.params.id
  );

  if (!gauge) {
    return res.status(404).json({
      error: "Gauge not found"
    });
  }

  res.json(gauge);
});

/*
 Gauge discovery
*/

async function discoverStations() {

  const stations = new Map();

  const response =
    await axios.get(ROOT, {
      timeout: 30000
    });

  const $ = cheerio.load(response.data);

  const catchmentLinks = [];

  $("a").each((_, el) => {

    const href =
      $(el).attr("href") || "";

    if (
      href.endsWith(".shtml")
    ) {
      catchmentLinks.push(
        new URL(
          href,
          ROOT
        ).href
      );
    }
  });

  console.log(
    `Found ${catchmentLinks.length} pages`
  );

  for (const page of catchmentLinks) {

    try {

      const r =
        await axios.get(page, {
          timeout: 30000
        });

      const $page =
        cheerio.load(r.data);

      $page("a").each((_, link) => {

        const href =
          $page(link).attr("href") || "";

        const text =
          $page(link).text().trim();

        const m =
          href.match(
            /\.([0-9]{6})\.plt\.shtml/i
          );

        if (!m) return;

        const id = m[1];

        stations.set(id, {
          id,
          name:
            text || id,
          url:
            new URL(
              href,
              page
            ).href
        });
      });

    } catch (err) {

      console.error(
        page,
        err.message
      );
    }
  }

  return [
    ...stations.values()
  ];
}

/*
 Scrape single gauge
*/

async function scrapeGauge(
  station
) {

  try {

    const r =
      await axios.get(
        station.url,
        {
          timeout: 30000
        }
      );

    const $ =
      cheerio.load(r.data);

    const title =
      $("title")
        .text()
        .trim();

    const readings =
      [];

    $("tr").each(
      (_, row) => {

        const cols =
          $(row).find("td");

        if (
          cols.length < 2
        ) return;

        const timestamp =
          cols.eq(0)
            .text()
            .trim();

        const level =
          parseFloat(
            cols.eq(1)
              .text()
              .trim()
          );

        if (
          !isNaN(level)
        ) {

          readings.push({
            timestamp,
            level
          });
        }
      }
    );

    if (
      readings.length === 0
    ) {
      return null;
    }

    const latest =
      readings[
        readings.length - 1
      ];

    return {
      id: station.id,
      name:
        title ||
        station.name,
      level:
        latest.level
