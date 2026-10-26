import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());

let gaugeCache = [];

function getFloodStatus(level, gauge) {
  if (level >= gauge.major) return "Major";
  if (level >= gauge.moderate) return "Moderate";
  if (level >= gauge.minor) return "Minor";
  return "Normal";
}

async function discoverGauges() {
  return [
    {
      id: "041499",
      name: "Condamine River at Tummaville",
      catchment: "Condamine-Balonne",
      url: "https://www.bom.gov.au/fwo/IDQ65396/IDQ65396.041499.plt.shtml",
      lat: -27.9,
      lon: 151.4,
      minor: 5,
      moderate: 8,
      major: 9
    }
  ];
}

async function scrapeGauge(gauge) {
  try {
    const response = await axios.get(gauge.url);

    const $ = cheerio.load(response.data);

    const readings = [];

    $("tr").each((i, row) => {
      const cols = $(row).find("td");

      if (cols.length >= 2) {
        const timestamp = cols.eq(0).text().trim();
        const level = parseFloat(cols.eq(1).text().trim());

        if (!isNaN(level)) {
          readings.push({
            timestamp,
            level
          });
        }
      }
    });

    const latest = readings[readings.length - 1];

    if (!latest) return null;

    return {
      id: gauge.id,
      name: gauge.name,
      catchment: gauge.catchment,
      lat: gauge.lat,
      lon: gauge.lon,
      level: latest.level,
      timestamp: latest.timestamp,
      status: getFloodStatus(latest.level, gauge)
    };
  } catch (error) {
    console.error(error.message);
    return null;
  }
}

async function refreshGauges() {
  const gauges = await discoverGauges();

  const results = await Promise.all(
    gauges.map(scrapeGauge)
  );

  gaugeCache = results.filter(Boolean);

  console.log(
    `Updated ${gaugeCache.length} gauges`
  );
}

app.get("/api/gauges", (req, res) => {
  res.json(gaugeCache);
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    gauges: gaugeCache.length,
    updated: new Date()
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`Running on ${PORT}`);

  await refreshGauges();

  setInterval(
    refreshGauges,
    5 * 60 * 1000
  );
});
