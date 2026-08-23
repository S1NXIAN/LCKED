import { describe, expect, it } from "vitest";

import { parseCsv, rowToObject } from "@/lib/import/csv";

describe("parseCsv", () => {
  it("parses a simple CSV", () => {
    const csv = "a,b,c\n1,2,3";
    expect(parseCsv(csv)).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("strips a leading UTF-8 BOM", () => {
    const csv = "﻿a,b\n1,2";
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles \\r-only line endings (old Mac)", () => {
    const csv = "a,b\r1,2\r3,4";
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles quoted fields and escaped quotes", () => {
    const csv = 'a,"b,c","d""e"';
    expect(parseCsv(csv)).toEqual([["a", "b,c", 'd"e']]);
  });

  it("handles unclosed quotes by returning partial data", () => {
    const csv = 'a,b\n1,"unclosed';
    const rows = parseCsv(csv);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // The last field will contain everything after the opening quote.
    expect(rows[1][1]).toContain("unclosed");
  });

  it("returns empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("filters out blank rows", () => {
    const csv = "a,b\n\n1,2\n";
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const csv = "a,b\r\n1,2\r\n";
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("rowToObject", () => {
  it("maps headers to row values", () => {
    const headers = ["name", "type", "notes"];
    const row = ["My Item", "login", "some notes"];
    expect(rowToObject(headers, row)).toEqual({
      name: "My Item",
      type: "login",
      notes: "some notes",
    });
  });

  it("trims whitespace from headers and values", () => {
    const headers = [" name ", " type "];
    const row = ["  Alice  ", " login "];
    expect(rowToObject(headers, row)).toEqual({ name: "Alice", type: "login" });
  });

  it("defaults missing values to empty string", () => {
    const headers = ["a", "b", "c"];
    const row = ["1", "2"];
    expect(rowToObject(headers, row)).toEqual({ a: "1", b: "2", c: "" });
  });
});
