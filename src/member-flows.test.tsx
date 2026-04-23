import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./services/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabaseClient: null,
}));

describe("Member flows", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it("lets member start workout mode from training tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som Emma/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Trening" })[0]);
    await user.click(screen.getByRole("button", { name: "Start økt" }));

    expect(await screen.findByText("Økt-modus")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Avbryt" })).toBeInTheDocument();
  });

  it("supports member messaging with trainer", async () => {
    const user = userEvent.setup();
    render(<App />);

    const memberMessage = "Medlem testmelding";
    await user.click(screen.getAllByRole("button", { name: /Logg inn som Emma/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Meldinger" })[0]);
    await user.type(screen.getByPlaceholderText("Skriv melding til trener"), memberMessage);
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText(memberMessage)).toBeInTheDocument();
  });

  it("persists local state after reload", async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);
    await user.type(screen.getByPlaceholderText("Navn"), "Persist Kunde");
    await user.type(screen.getByPlaceholderText("E-post"), "persist.kunde@example.com");
    await user.click(screen.getByRole("button", { name: "Opprett medlem" }));
    expect(window.localStorage.getItem("motus_pt_app_v2")).toContain("persist.kunde@example.com");

    firstRender.unmount();
    render(<App />);
    expect(window.localStorage.getItem("motus_pt_app_v2")).toContain("persist.kunde@example.com");
  });
});
