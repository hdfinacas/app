import { beforeEach, describe, expect, it } from "vitest";
import { getRememberMe, rememberMeStorage, setRememberMe } from "@/integrations/supabase/remember";

describe("remember me storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("moves the Supabase session when the preference changes", () => {
    localStorage.setItem("sb-test-auth-token", "persisted-session");

    setRememberMe(false);
    expect(getRememberMe()).toBe(false);
    expect(localStorage.getItem("sb-test-auth-token")).toBeNull();
    expect(sessionStorage.getItem("sb-test-auth-token")).toBe("persisted-session");

    setRememberMe(true);
    expect(getRememberMe()).toBe(true);
    expect(sessionStorage.getItem("sb-test-auth-token")).toBeNull();
    expect(localStorage.getItem("sb-test-auth-token")).toBe("persisted-session");
  });

  it("writes through to the currently selected storage", () => {
    setRememberMe(false);
    rememberMeStorage.setItem("sb-test-auth-token", "temporary-session");
    expect(sessionStorage.getItem("sb-test-auth-token")).toBe("temporary-session");
    expect(localStorage.getItem("sb-test-auth-token")).toBeNull();
  });
});
