import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./services/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabaseClient: null,
}));

describe("App regressions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it("shows login error for invalid credentials", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText("E-post"), "wrong@example.com");
    await user.type(screen.getByPlaceholderText("Passord"), "badpass");
    await user.click(screen.getByRole("button", { name: "Logg inn" }));

    expect(screen.getByText("Feil e-post eller passord.")).toBeInTheDocument();
  });

  it("allows trainer to add a customer from form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);
    await user.type(screen.getByPlaceholderText("Navn"), "Ny Kunde");
    await user.type(screen.getByPlaceholderText("E-post"), "ny.kunde@example.com");
    await user.click(screen.getByRole("button", { name: "Opprett medlem" }));

    expect(screen.getByPlaceholderText("Navn")).toHaveValue("");
    expect(screen.getByPlaceholderText("E-post")).toHaveValue("");
  });

  it("lets member start and finish a workout session", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som Emma/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Trening" })[0]);
    await user.click(screen.getByRole("button", { name: "Start økt" }));

    expect(await screen.findByText("Økt-modus")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Avbryt" })).toBeInTheDocument();
  });

  it("shows customer program builder for trainer", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Klienter" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Program" })[0]);

    expect(screen.getByText("Bygg program")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lagre program på kunde" })).toBeInTheDocument();
  });

  it("supports messaging from trainer and member", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trainerMessage = "Trener testmelding";
    const memberMessage = "Medlem testmelding";

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Meldinger" })[0]);
    await user.type(screen.getByPlaceholderText("Skriv melding til kunden"), trainerMessage);
    await user.click(screen.getAllByRole("button", { name: "Send" })[0]);

    await user.click(screen.getByRole("button", { name: "Medlemsside" }));
    await user.click(screen.getAllByRole("button", { name: "Meldinger" })[0]);

    expect(screen.getByText(trainerMessage)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Skriv melding til trener"), memberMessage);
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText(memberMessage)).toBeInTheDocument();
  });

  it("persists state after reload via localStorage", async () => {
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

  it("lets trainer deactivate a member and reveal them from inactive list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Klienter" })[0]);
    await user.click(screen.getByRole("button", { name: "Sett medlem som inaktiv" }));
    expect(screen.getByRole("button", { name: "Vis inaktive" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Vis inaktive" }));
    expect(screen.getByRole("button", { name: "Skjul inaktive" })).toBeInTheDocument();
  });
});
