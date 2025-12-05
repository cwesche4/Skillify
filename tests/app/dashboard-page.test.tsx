import DashboardPage from "@/app/dashboard/page";
import { describe, expect, it } from "vitest";

describe("DashboardPage module", () => {
  it("exports a component", () => {
    expect(DashboardPage).toBeDefined();
    expect(typeof DashboardPage).toBe("function");
  });
});