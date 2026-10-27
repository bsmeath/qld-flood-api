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

const STATION_INDEX =
  "https://www.bom.gov.au/qld/flood/networks/section3.shtml";

let gauges = [];
let updated = null;

function classify(level, thresholds) {
  if (level == null || !thresholds) {
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

function dmsToDecimal(latRaw, lonRaw) {
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

  return { lat, lon };
}

async function loadCatalogue() {
  const response =
    await http.get(STATION_INDEX);

  const $ =
    cheerio.load(response.data);

  const text =
    $("pre").text();

  const lines =
    text.split("\n");

  const stations = [];

  for (const line of lines) {
    const match = line.match(
      /^\s*(\d{6})\s+(\d+)?\s+(.+?)\s{2,}(.+?)\s{2,}(.+?)\s+(\d{6,7}S)\s+(\d{7}E)\s*$/
    );

    if (!match) continue;

    try {
      const coords =
        dmsToDecimal(
          match[6],
          match[7]
        );

      stations.push({
        id: match[1],
        name: match[3].trim(),
        stream: match[4].trim(),
        basin: match[5].trim(),
        lat: coords.lat,
        lon: coords.lon,
        level: null,
        timestamp: null,
        thresholds: null,
        status: "Unknown"
      });
    } catch {}
  }

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
        "Failed page:",
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

    if (!rows.length) {
      return null;
    }

    const latest =
      rows[rows.length - 1];

    return {
      timestamp: latest[0],
      level:
        parseFloat(latest[1])
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
    station.fwoId =
      fwo.idq;

    station.tbl =
      fwo.tbl;

    station.plt =
      fwo.plt;

    const live =
      await getLatestLevel(
        fwo.tbl
      );

    if (live) {
      station.level =
        live.level;

      station.timestamp =
        live.timestamp;
    }

    const thresholds =
      await getThresholds(
        fwo
      );

    station.thresholds =
      thresholds;

    station.status =
      classify(
        station.level,
        thresholds
      );

  } catch {
    station.status =
      "Unknown";
  }

  return station;
}

async function refresh() {
  try {

    console.log(
      "Loading catalogue..."
    );

    const stationList =
      await loadCatalogue();

    console.log(
      `Stations: ${stationList.length}`
    );

    const lookup =
      await buildFwoLookup();

    console.log(
      `FWO Links: ${Object.keys(lookup).length}`
    );

    gauges =
      stationList;

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
        batch.map(station =>
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

    gauges =
      stationList;

    updated =
      new Date().toISOString();

    const flooded =
      gauges.filter(
        g =>
          g.status === "Major" ||
          g.status === "Moderate"
      );

    console.log(
      `Flooded stations: ${flooded.length}`
    );

    console.log(
      "Refresh complete"
    );

  } catch (err) {

    console.error(
      "REFRESH FAILED",
      err
    );

  }
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

  const catchments = {};

  for (const gauge of flooded) {

    const catchment =
      gauge.stream ||
      gauge.basin ||
      "Unknown";

    if (!catchments[catchment]) {
      catchments[catchment] = [];
    }

    catchments[catchment].push({
      id: gauge.id,
      name: gauge.name,
      stream: gauge.stream,
      basin: gauge.basin,
      level: gauge.level,
      status: gauge.status,
      timestamp: gauge.timestamp,
      thresholds: gauge.thresholds,
      lat: gauge.lat,
      lon: gauge.lon
    });
  }

  res.json(
    Object.entries(catchments)
      .map(([catchment, stations]) => ({
        catchment,
        stations
      }))
      .sort(
        (a, b) =>
          b.stations.length -
          a.stations.length
      )
  );

});

app.get("/api/catchment-summary", (req, res) => {

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

    if (gauge.status === "Major") {
      summary[catchment].major++;
    }

    if (gauge.status === "Moderate") {
      summary[catchment].moderate++;
    }

  }

  res.json(
    Object.values(summary)
      .sort(
        (a, b) =>
          b.stations -
          a.stations
      )
  );

});
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
