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
        await http.
