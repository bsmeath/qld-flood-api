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

const STATION_INDEX =
  "https://www.bom.gov.au/qld/flood/networks/section3.shtml";

let gaugeCache = [];
let lastRefresh = null;

function convertLatLon(latRaw, lonRaw) {

  const latDeg =
    parseInt(latRaw.slice(0, 2));

  const latMin =
    parseInt(latRaw.slice(2, 4));

  const latSec =
    parseInt(latRaw.slice(4, 6));

  const lat =
    -(
      latDeg +
      latMin / 60 +
      latSec / 3600
    );

  const lonDeg =
    parseInt(lonRaw.slice(0, 3));

  const lonMin =
    parseInt(lonRaw.slice(3, 5));

  const lonSec =
    parseInt(lonRaw.slice(5, 7));

  const lon =
    lonDeg +
    lonMin / 60 +
    lonSec / 3600;

  return {
    lat,
    lon
  };
}

async function loadStations() {

  const response =
    await http.get(STATION_INDEX);

  const text =
    cheerio.load(response.data)(
      "pre"
    ).text();

  const stations = [];

  const lines =
    text.split("\n");

  for (const line of lines) {

    const match =
      line.match(
        /^\s*(\d{6})\s+(\d+)?\s+([A-Z0-9\s\-\(\)]+?)\s{2,}([A-Z0-9\s\-\(\)]+?)\s{2,}([A-Z\-\s]+?)\s+(\d{6,7}S)\s+(\d{7}E)/i
      );

    if (!match) continue;

    const coords =
      convertLatLon(
        match[6],
        match[7]
      );

    stations.push({
      id: match[1],
      awrc:
        match[2] || "",
      name:
        match[3].trim(),
      stream:
        match[4].trim(),
      basin:
        match[5].trim(),
      lat: coords.lat,
      lon: coords.lon,
      level: null,
      status: "Unknown"
    });

  }

  return stations;
}

async function refreshStations() {

  try {

    console.log(
      "Loading station catalogue..."
    );

    gaugeCache =
      await loadStations();

    lastRefresh =
      new Date().toISOString();

    console.log(
      `Loaded ${gaugeCache.length} stations`
    );

  } catch (err) {

    console.error(
      err.message
    );

  }

}

app.get("/api/status", (req, res) => {

  res.json({
    status: "online",
    gauges:
      gaugeCache.length,
    updated:
      lastRefresh
  });

});

app.get("/api/gauges", (req, res) => {

  res.json(
    gaugeCache
  );

});

app.listen(
  PORT,
  async () => {

    console.log(
      `Running on ${PORT}`
    );

    await refreshStations();

    setInterval(
      refreshStations,
      5 * 60 * 1000
    );

  }
);
