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

const DISCOVERY_PAGES = [
  "https://www.bom.gov.au/qld/flood/",
  "https://www.bom.gov.au/qld/flood/rain_river.shtml"
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function determineStatus(level) {
  if (level >= 9) return "Major";
  if (level >= 8) return "Moderate";
  if (level >= 5) return "Minor";
  return "Normal";
}

async function discoverCatchmentPages() {
  const pages = new Map();

  for (const url of DISCOVERY_PAGES) {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          "User-Agent": "QLD-Flood-Collector"
        }
      });

      const $ = cheerio.load(response.data);

      $("a").each((_, el) => {
        const href = $(el).attr("href");

        if (!href) return;

        const absolute =
          new URL(href, url).toString();

        if (
          absolute.includes("/qld/flood/") &&
          absolute.endsWith(".shtml")
        ) {
          pages.set(
            absolute,
            absolute
          );
        }
      });
    } catch (err) {
      console.error(
        "Catchment discovery failed:",
        url,
        err.message
      );
    }
  }

  return [...pages.values()];
}

async function discoverStationsFromPage(pageUrl) {
  const stations = [];

  try {
    const response = await axios.get(pageUrl, {
      timeout: 30000
    });

    const $ = cheerio.load(response.data);

    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";

      const gaugeMatch =
        href.match(
          /\.([0-9]{6})\.plt\.shtml/i
        );

      if (!gaugeMatch) return;

      const stationId = gaugeMatch[1];

      const stationUrl =
        new URL(
          href,
          pageUrl
        ).toString();

      stations.push({
        id: stationId,
        url: stationUrl,
        name:
          $(el).text().trim() ||
          stationId
      });
    });
  } catch (err) {
    console.error(
      "Station discovery failed:",
      pageUrl,
      err.message
    );
  }

  return stations;
}

async function discoverAllStations() {
  console.log("Discovering stations...");

  const catchmentPages =
    await discoverCatchmentPages();

  const results =
    await Promise.all(
      catchmentPages.map(
        discoverStationsFromPage
      )
    );

  const stations =
    results.flat();

  const unique =
    new Map();

  for (const station of stations) {
    unique.set(
      station.id,
      station
    );
  }

  console.log(
    `Discovered ${unique.size} stations`
  );

  return [...unique.values()];
}

async function scrapeGauge(station) {
  try {
    const response =
      await axios.get(
        station.url,
        {
          timeout: 30000,
          headers: {
            "User-Agent":
              "QLD-Flood-Collector"
          }
        }
      );

    const $ = cheerio.load(
      response.data
    );

    const pageTitle =
      $("h1")
        .first()
        .text()
        .trim() ||
      $("title")
        .text()
        .trim();

    const observations =
      [];

    $("tr").each(
      (_, row) => {
        const cols =
          $(row).find("td");

        if (
          cols.length < 2
        )
          return;

        const timestamp =
          cols
            .eq(0)
            .text()
            .trim();

        const level =
          parseFloat(
            cols
              .eq(1)
              .text()
              .trim()
          );

        if (
          !isNaN(level)
        ) {
          observations.push({
            timestamp,
            level
          });
        }
      }
    );

    const latest =
      observations[
        observations.length -
          1
      ];

    if (!latest)
      return null;

    return {
      id: station.id,
      name:
        pageTitle ||
        station.name,
      level:
        latest.level,
      observed:
        latest.timestamp,
      status:
        determineStatus(
          latest.level
        ),
      lat: null,
      lon: null,
      history:
        observations.slice(
          -100
        )
    };
  } catch (err) {
    console.error(
      `Failed ${station.id}:`,
      err.message
    );

    return null;
  }
}

async function refreshGauges() {
  console.log(
    "Refreshing gauges..."
  );

  if (
    discoveredStations.length ===
    0
  ) {
    discoveredStations =
      await discoverAllStations();
  }

  const results =
    await Promise.allSettled(
      discoveredStations.map(
        scrapeGauge
      )
    );

  gaugeCache =
    results
      .filter(
        r =>
          r.status ===
            "fulfilled" &&
          r.value
      )
      .map(
        r => r.value
      );

  lastRefresh =
    new Date()
      .toISOString();

  console.log(
    `Loaded ${gaugeCache.length} gauges`
  );
}

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      status:
        "online",
      gauges:
        gaugeCache.length,
      discovered:
        discoveredStations.length,
      updated:
        lastRefresh
    });
  }
);

app.get(
  "/api/gauges",
  (req, res) => {
    res.json(
      gaugeCache
    );
  }
);

app.get(
  "/api/gauges/:id",
  (req, res) => {
    const gauge =
      gaugeCache.find(
        g =>
          g.id ===
          req.params.id
      );

    if (!gauge) {
      return res
        .status(404)
        .json({
          error:
            "Gauge not found"
        });
    }

    res.json(gauge);
  }
);

app.listen(
  PORT,
  async () => {
    console.log(
      `Listening on ${PORT}`
    );

    await refreshGauges();

    setInterval(
      refreshGauges,
      5 * 60 * 1000
    );
  }
);
