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

const STATION_INDEX =
  "https://www.bom.gov.au/qld/flood/networks/section3.shtml";

const FLOOD_PAGES = [
  "https://www.bom.gov.au/qld/flood/brisbane.shtml",
  "https://www.bom.gov.au/qld/flood/mary.shtml",
  "https://www.bom.gov.au/qld/flood/widebay.shtml",
  "https://www.bom.gov.au/qld/flood/seast.shtml",
  "https://www.bom.gov.au/qld/flood/albert.shtml",
  "https://www.bom.gov.au/qld/flood/central.shtml",
  "https://www.bom.gov.au/qld/flood/townsville.shtml",
  "https://www.bom.gov.au/qld/flood/gulf.shtml",
  "https://www.bom.gov.au/qld/flood/west.shtml",
  "https://www.bom.gov.au/qld/flood/border.shtml",
  "https://www.bom.gov.au/qld/flood/macintyre.shtml",
  "https://www.bom.gov.au/qld/flood/north.shtml"
];

let gauges = [];
let updated = null;

function classify(level, thresholds) {

  if (
    level == null ||
    !thresholds
  ) {
    return "Unknown";
  }

  if (
    thresholds.major != null &&
    level >= thresholds.major
  ) {
    return "Major";
  }

  if (
    thresholds.moderate != null &&
    level >= thresholds.moderate
  ) {
    return "Moderate";
  }

  if (
    thresholds.minor != null &&
    level >= thresholds.minor
  ) {
    return "Minor";
  }

  return "Normal";
}

function dmsToDecimal(
  latRaw,
  lonRaw
) {

  const lat =
    -(
      parseInt(latRaw.slice(0, 2)) +
      parseInt(latRaw.slice(2, 4)) / 60 +
      parseInt(latRaw.slice(4, 6)) / 3600
    );

  const lon =
    parseInt(lonRaw.slice(0, 3)) +
    parseInt(lonRaw.slice(3, 5)) / 60 +
    parseInt(lonRaw.slice(5, 7)) / 3600;

  return {
    lat,
    lon
  };
}

function determineTrend(
  current,
  previous
) {

  if (
    current == null ||
    previous == null
  ) {
    return "unknown";
  }

  const diff =
    current - previous;

  if (diff > 0.02) {
    return "rising";
  }

  if (diff < -0.02) {
    return "falling";
  }

  return "steady";
}

async function loadCatalogue() {

  const response =
    await http.get(STATION_INDEX);

  const $ =
    cheerio.load(response.data);

  const text =
    $("pre").text();

  const stations = [];

  text.split("\n")
    .forEach(line => {

      const match =
        line.match(
          /^\s*(\d{6})\s+(\d+)?\s+(.+?)\s{2,}(.+?)\s{2,}(.+?)\s+(\d{6,7}S)\s+(\d{7}E)\s*$/
        );

      if (!match) {
        return;
      }

      const coords =
        dmsToDecimal(
          match[6],
          match[7]
        );

      stations.push({

        id: match[1],

        name:
          match[3].trim(),

        stream:
          match[4].trim(),

        basin:
          match[5].trim(),

        lat: coords.lat,
        lon: coords.lon,

        level: null,
        previousLevel: null,
        change: null,
        trend: "unknown",
        rapidRise: false,

        timestamp: null,

        thresholds: null,

        status: "Unknown"
      });

    });

  return stations;
}

async function buildFwoLookup() {

  const lookup = {};

  for (const page of FLOOD_PAGES) {

    try {

      const response =
        await http.get(page);

      const $ =
        cheerio.load(response.data);

      $("area").each((_, area) => {

        const href =
          $(area).attr("href");

        if (!href) return;

        const match =
          href.match(
            /\/fwo\/(IDQ\d+)\/\1\.(\d{6})\.plt\.shtml/
          );

        if (!match) return;

        lookup[match[2]] = {

          idq: match[1],

          plt:
            `https://www.bom.gov.au${href}`,

          tbl:
            `https://www.bom.gov.au${href.replace(
              ".plt.shtml",
              ".tbl.shtml"
            )}`

        };

      });

    } catch (err) {

      console.log(
        "Failed:",
        page
      );

    }

  }

  return lookup;
}

async function getLatestLevel(tblUrl) {

  try {

    const response =
      await http.get(tblUrl);

    const $ =
      cheerio.load(response.data);

    const rows = [];

    $("tr").each((_, tr) => {

      const cols = [];

      $(tr)
        .find("td")
        .each((__, td) => {
          cols.push(
            $(td).text().trim()
          );
        });

      if (cols.length >= 2) {
        rows.push(cols);
      }

    });

    if (rows.length < 2) {
      return null;
    }

    const latest =
      rows[rows.length - 1];

    const previous =
      rows[rows.length - 2];

    const level =
      parseFloat(latest[1]);

    const previousLevel =
      parseFloat(previous[1]);

    const change =
      level - previousLevel;

    return {

      timestamp:
        latest[0],

      level,

      previousLevel,

      change,

      trend:
        determineTrend(
          level,
          previousLevel
        ),

      rapidRise:
        change >= 0.50

    };

  } catch {

    return null;

  }

}

async function getThresholds(fwo) {

  try {

    const response =
      await http.get(fwo.plt);

    const text =
      cheerio
        .load(response.data)
        .text();

    const thresholds = {};

    const minor =
      text.match(
        /Minor:\s*([\d.]+)/i
      );

    const moderate =
      text.match(
        /Moderate:\s*([\d.]+)/i
      );

    const major =
      text.match(
        /Major:\s*([\d.]+)/i
      );

    if (minor) {
      thresholds.minor =
        parseFloat(minor[1]);
    }

    if (moderate) {
      thresholds.moderate =
        parseFloat(moderate[1]);
    }

    if (major) {
      thresholds.major =
        parseFloat(major[1]);
    }

    return Object.keys(thresholds).length
      ? thresholds
      : null;

  } catch {

    return null;

  }

}

async function enrichStation(
  station,
  fwo
) {

  try {

    const live =
      await getLatestLevel(
        fwo.tbl
      );

    const thresholds =
      await getThresholds(
        fwo
      );

    if (live) {

      station.level =
        live.level;

      station.previousLevel =
        live.previousLevel;

      station.change =
        live.change;

      station.trend =
        live.trend;

      station.rapidRise =
        live.rapidRise;

      station.timestamp =
        live.timestamp;

    }

    station.thresholds =
      thresholds;

    station.status =
      classify(
        station.level,
        thresholds
      );

    station.fwoId =
      fwo.idq;

    station.tbl =
      fwo.tbl;

    station.plt =
      fwo.plt;

  } catch {}

  return station;
}

async function refresh() {

  console.log(
    "Loading catalogue..."
  );

  const stationList =
    await loadCatalogue();

  const lookup =
    await buildFwoLookup();

  gauges = stationList;

  updated =
    new Date().toISOString();

  const matchedStations =
    stationList.filter(
      s => lookup[s.id]
    );

  console.log(
    `Matched: ${matchedStations.length}`
  );

  const batchSize = 50;

  for (
    let i = 0;
    i < matchedStations.length;
    i += batchSize
  ) {

    const batch =
      matchedStations.slice(
        i,
        i + batchSize
      );

    await Promise.all(
      batch.map(
        station =>
          enrichStation(
            station,
            lookup[station.id]
          )
      )
    );

    console.log(
      `${Math.min(
        i + batchSize,
        matchedStations.length
      )}/${matchedStations.length}`
    );
  }

  gauges = stationList;

  updated =
    new Date().toISOString();

  console.log(
    "Refresh complete"
  );
}

app.get("/api/status", (req, res) => {

  res.json({
    status: "online",
    gauges:
      gauges.length,
    updated
  });

});

app.get("/api/gauges", (req, res) => {
  res.json(gauges);
});

app.get("/api/flooded", (req, res) => {

  res.json(
    gauges.filter(
      g =>
        g.status === "Major" ||
        g.status === "Moderate"
    )
  );

});

app.get("/api/major", (req, res) => {

  res.json(
    gauges.filter(
      g =>
        g.status === "Major"
    )
  );

});

app.get("/api/moderate", (req, res) => {

  res.json(
    gauges.filter(
      g =>
        g.status === "Moderate"
    )
  );

});

app.get("/api/catchments", (req, res) => {

  const flooded =
    gauges.filter(
      g =>
        g.status === "Major" ||
        g.status === "Moderate"
    );

  const groups = {};

  for (const gauge of flooded) {

    const catchment =
      gauge.stream ||
      gauge.basin ||
      "Unknown";

    if (!groups[catchment]) {
      groups[catchment] = [];
    }

    groups[catchment].push(gauge);

  }

  res.json(
    Object.entries(groups).map(
      ([catchment, stations]) => ({
        catchment,
        stations
      })
    )
  );

});

app.get(
  "/api/catchment-summary",
  (req, res) => {

    const flooded =
      gauges.filter(
        g =>
          g.status === "Major" ||
          g.status === "Moderate"
      );

    const summary = {};

    for (const gauge of flooded) {

      const catchment =
        gauge.stream ||
        gauge.basin ||
        "Unknown";

      if (!summary[catchment]) {

        summary[catchment] = {
          catchment,
          stations: 0,
          major: 0,
          moderate: 0
        };

      }

      summary[catchment].stations++;

      if (
        gauge.status === "Major"
      ) {
        summary[catchment].major++;
      }

      if (
        gauge.status === "Moderate"
      ) {
        summary[catchment].moderate++;
      }

    }

    res.json(
      Object.values(summary)
    );

  }
);

app.listen(PORT, () => {

  console.log(
    `Listening on ${PORT}`
  );

  refresh();

  setInterval(
    refresh,
    15 * 60 * 1000
  );

});
