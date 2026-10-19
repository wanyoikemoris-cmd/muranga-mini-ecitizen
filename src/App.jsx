
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const categories = [
  "Road maintenance",
  "Water services",
  "Public health",
  "Business permits",
  "Social services",
  "Other",
];

const wardsByConstituency = {
  Kangema: ["Kanyenya-Ini", "Muguru", "Rwathia"],
  Mathioya: ["Gitugi", "Kiru", "Kamacharia"],
  Kiharu: ["Wangu", "Mugoiri", "Mbiri", "Township", "Murarandia", "Gaturi"],
  Kigumo: ["Kahumbu", "Muthithi", "Kigumo", "Kangari", "Kinyona"],
  Maragua: [
    "Kimorori/Wempa",
    "Makuyu",
    "Kambiti",
    "Kamahuha",
    "Ichagaki",
    "Nginda",
  ],
  Kandara: [
    "Ng'araria",
    "Muruka",
    "Kagundu-Ini",
    "Gaichanjiru",
    "Ithiru",
    "Ruchu",
  ],
  Gatanga: [
    "Ithanga",
    "Kakuzi/Mitubiri",
    "Mugumo-Ini",
    "Kihumbu-Ini",
    "Gatanga",
    "Kariara",
  ],
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const [authMode, setAuthMode] = useState("login");
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
  });

  const [form, setForm] = useState({
    service: categories[0],
    constituency: "",
    ward: "",
    location: "",
    description: "",
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Restore the current session and listen for login/logout changes.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        setNotice(error.message);
      }

      setSession(data?.session ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (active) {
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecoveryMode(true);
          setAuthMode("update-password");
          setNotice("Choose a new password for your account.");
        }
        setSession(newSession);
        setAuthReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load requests permitted for this user and check administrator access.
  useEffect(() => {
    let active = true;

    async function loadPortalData() {
      const user = session?.user;

      if (!user) {
        setRequests([]);
        setIsAdmin(false);
        setLoadingRequests(false);
        return;
      }

      setLoadingRequests(true);

      try {
        const [adminResult, requestResult] = await Promise.all([
          supabase
            .from("app_admins")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle(),

          supabase
            .from("service_requests")
            .select(
              "reference_number, service_category, constituency, ward, location, description, image_url, status, created_at"
            )
            .order("created_at", { ascending: false }),
        ]);

        if (!active) return;

        if (adminResult.error) {
          throw new Error(
            `Could not check administrator access: ${adminResult.error.message}`
          );
        }

        if (requestResult.error) {
          throw new Error(
            `Could not load requests: ${requestResult.error.message}`
          );
        }

        const mappedRequests = await Promise.all(
          (requestResult.data ?? []).map(async (row) => {
            let imageUrl = "";

            if (row.image_url) {
              const { data: signedData, error: signedError } =
                await supabase.storage
                  .from("request-images")
                  .createSignedUrl(row.image_url, 60 * 60);

              if (!signedError) {
                imageUrl = signedData?.signedUrl ?? "";
              }
            }

            return {
              id: row.reference_number,
              service: row.service_category,
              constituency: row.constituency ?? "",
              ward: row.ward ?? "",
              location: row.location ?? "",
              description: row.description ?? "",
              imagePath: row.image_url ?? "",
              imageUrl,
              status: row.status,
              date: row.created_at
                ? new Date(row.created_at).toLocaleDateString("en-CA")
                : "",
            };
          })
        );

        if (!active) return;

        setIsAdmin(Boolean(adminResult.data));
        setRequests(mappedRequests);
      } catch (error) {
        if (active) {
          setNotice(error.message || "Could not load the service portal.");
        }
      } finally {
        if (active) {
          setLoadingRequests(false);
        }
      }
    }

    loadPortalData();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // Dashboard statistics.
  const stats = useMemo(
    () => ({
      total: requests.length,
      open: requests.filter((request) => request.status !== "Resolved").length,
      pending: requests.filter((request) => request.status === "Pending").length,
      resolved: requests.filter((request) => request.status === "Resolved")
        .length,
    }),
    [requests]
  );

  // Search and filter the requests visible to the current account.
  const visibleRequests = requests.filter((request) => {
    const matchesFilter = filter === "All" || request.status === filter;
    const query = search.trim().toLowerCase();

    const searchableValues = [
      request.id,
      request.service,
      request.constituency,
      request.ward,
      request.location,
      request.description,
    ];

    const matchesSearch = searchableValues.some((value) =>
      String(value ?? "").toLowerCase().includes(query)
    );

    return matchesFilter && matchesSearch;
  });

  function validateStrongPassword(password) {
    if (password.length < 8) return "Use at least 8 characters.";
    if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter (A–Z).";
    if (!/[a-z]/.test(password)) return "Add at least one lowercase letter (a–z).";
    if (!/\d/.test(password)) return "Add at least one number (0–9).";
    if (!/[^A-Za-z0-9]/.test(password)) {
      return "Add at least one special character, such as !, @ or #.";
    }
    return "";
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");

    try {
      const email = authForm.email.trim().toLowerCase();
      const password = authForm.password;

      if (authMode === "reset-request") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setNotice(
          "If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder."
        );
        return;
      }

      if (authMode === "update-password") {
        const passwordError = validateStrongPassword(password);
        if (passwordError) throw new Error(passwordError);

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;

        setPasswordRecoveryMode(false);
        setAuthMode("login");
        setAuthForm((current) => ({ ...current, password: "" }));
        await supabase.auth.signOut();
        setNotice("Password updated successfully. Please sign in with your new password.");
        return;
      }

      if (authMode === "signup") {
        const passwordError = validateStrongPassword(password);
        if (passwordError) throw new Error(passwordError);

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data.session) {
          setNotice("Account created. You are now signed in.");
        } else {
          setNotice(
            "Registration received. Check your email for a confirmation link before signing in."
          );
          setAuthMode("login");
          setAuthForm((current) => ({ ...current, password: "" }));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setNotice("Signed in successfully.");
      }
    } catch (error) {
      setNotice(error.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setNotice("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setNotice(`Could not sign out: ${error.message}`);
    } else {
      setRequests([]);
      setIsAdmin(false);
      setNotice("You have signed out.");
    }
  }

  // Validate, upload the optional image, and save the service request.
  async function handleSubmit(event) {
    event.preventDefault();

    if (
      !form.constituency ||
      !form.ward ||
      !form.location.trim() ||
      !form.description.trim()
    ) {
      setNotice(
        "Please select a constituency and ward, enter the location details, and describe your request."
      );
      return;
    }

    if (selectedImage) {
      if (!allowedImageTypes.includes(selectedImage.type)) {
        setNotice("Choose a JPG, PNG or WebP image.");
        return;
      }

      if (selectedImage.size > MAX_IMAGE_SIZE) {
        setNotice("The image must be 5 MB or smaller.");
        return;
      }
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      setNotice(`Could not verify your session: ${sessionError.message}`);
      return;
    }

    const user = sessionData.session?.user;

    if (!user) {
      setNotice("Your session has expired. Please sign in again.");
      return;
    }

    setBusy(true);
    setNotice("");

    const referenceNumber = `MUR-${Date.now()}`;
    let uploadedImagePath = null;

    try {
      let imagePath = null;

      // 1. Upload the image into the user's own private Storage folder.
      if (selectedImage) {
        const extension =
          selectedImage.type === "image/jpeg"
            ? "jpg"
            : selectedImage.type === "image/png"
              ? "png"
              : "webp";

        imagePath = `${user.id}/${referenceNumber}-${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("request-images")
          .upload(imagePath, selectedImage, {
            contentType: selectedImage.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        uploadedImagePath = imagePath;
      }

      // 2. Save the request and its image path in the database.
      const { data, error } = await supabase
        .from("service_requests")
        .insert({
          reference_number: referenceNumber,
          user_id: user.id,
          service_category: form.service,
          constituency: form.constituency,
          ward: form.ward,
          location: form.location.trim(),
          description: form.description.trim(),
          image_url: imagePath,
          status: "Pending",
        })
        .select(
          "reference_number, service_category, constituency, ward, location, description, image_url, status, created_at"
        )
        .single();

      if (error) throw error;

      // 3. Create a temporary link to view the private image.
      let imageUrl = "";

      if (data.image_url) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("request-images")
          .createSignedUrl(data.image_url, 60 * 60);

        if (!signedError) {
          imageUrl = signedData?.signedUrl ?? "";
        }
      }

      // 4. Update the dashboard without requiring a page reload.
      const newRequest = {
        id: data.reference_number,
        service: data.service_category,
        constituency: data.constituency ?? "",
        ward: data.ward ?? "",
        location: data.location ?? "",
        description: data.description ?? "",
        imagePath: data.image_url ?? "",
        imageUrl,
        status: data.status,
        date: data.created_at
          ? new Date(data.created_at).toLocaleDateString("en-CA")
          : "",
      };

      setRequests((current) => [newRequest, ...current]);

      setForm({
        service: categories[0],
        constituency: "",
        ward: "",
        location: "",
        description: "",
      });

      setSelectedImage(null);
      setImageInputKey((current) => current + 1);
      setNotice(`Request ${data.reference_number} submitted successfully.`);
      setFilter("All");
      setSearch("");
    } catch (error) {
      // If the database insert fails after upload, remove the unused image.
      if (uploadedImagePath) {
        const { error: cleanupError } = await supabase.storage
          .from("request-images")
          .remove([uploadedImagePath]);

        if (cleanupError) {
          console.error(
            "Could not clean up the uploaded image:",
            cleanupError.message
          );
        }
      }

      setNotice(`Could not submit request: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Only authorized administrators can change a request's status.
  async function updateStatus(id, status) {
    if (!isAdmin) {
      setNotice("Only authorized administrators can change request status.");
      return;
    }

    setNotice("");

    const { data, error } = await supabase
      .from("service_requests")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("reference_number", id)
      .select("reference_number, status");

    if (error) {
      setNotice(`Could not update status: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setNotice(
        "No request was updated. Check your administrator access and database policies."
      );
      return;
    }

    setRequests((current) =>
      current.map((request) =>
        request.id === id ? { ...request, status } : request
      )
    );

    setNotice(`Request ${id} updated to ${status}.`);
  }

  if (!authReady) {
    return (
      <div className="auth-screen">
        <div className="auth-card">Connecting to the service portal…</div>
      </div>
    );
  }

  // Login and registration screen.
  if (!session || passwordRecoveryMode) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand auth-brand">
            <div className="brand-mark">M</div>
            <div>
              <strong>Huduma Murang’a</strong>
              <span>Public Service Portal</span>
            </div>
          </div>

          <p className="eyebrow">MURANG’A COUNTY GOVERNMENT</p>
          <h1>
            {authMode === "login"
              ? "Welcome"
              : authMode === "signup"
                ? "Create your account"
                : authMode === "reset-request"
                  ? "Reset your password"
                  : "Choose a new password"}
          </h1>
          <p className="subtitle">
            {authMode === "login"
              ? "Sign in to submit and track your service requests."
              : authMode === "signup"
                ? "Register to access the public service portal."
                : authMode === "reset-request"
                  ? "Enter your email address and we’ll send instructions to reset your password."
                  : "Create a strong new password for your account."}
          </p>

          <form onSubmit={handleAuthSubmit} className="request-form">
            {authMode !== "update-password" && (
              <label>
                Email address
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, email: event.target.value })
                  }
                  placeholder="you@example.com"
                />
              </label>
            )}

            {authMode !== "reset-request" && (
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={authMode === "login" ? 1 : 8}
                  pattern={
                    authMode === "login"
                      ? undefined
                      : "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}"
                  }
                  title={
                    authMode === "login"
                      ? "Enter your account password."
                      : "Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character."
                  }
                  autoComplete={
                    authMode === "login" ? "current-password" : "new-password"
                  }
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, password: event.target.value })
                  }
                  placeholder={
                    authMode === "login"
                      ? "Enter your password"
                      : "8+ characters, upper/lowercase, number, symbol"
                  }
                />
                {authMode !== "login" && (
                  <span className="field-hint">
                    Include uppercase and lowercase letters, a number and a special character.
                  </span>
                )}
              </label>
            )}

            <button
              className="primary-button submit-button"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Please wait…"
                : authMode === "login"
                  ? "Sign in"
                  : authMode === "signup"
                    ? "Create account"
                    : authMode === "reset-request"
                      ? "Send reset link"
                      : "Update password"}
            </button>
          </form>

          {authMode === "login" && (
            <p className="auth-switch">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setAuthMode("reset-request");
                  setAuthForm((current) => ({ ...current, password: "" }));
                  setNotice("");
                }}
              >
                Forgot password?
              </button>
            </p>
          )}

          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}

          <p className="auth-switch">
            {authMode === "login"
              ? "Don't have an account?"
              : authMode === "signup"
                ? "Already registered?"
                : "Remembered your password?"}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setPasswordRecoveryMode(false);
                setAuthMode(authMode === "login" ? "signup" : "login");
                setAuthForm((current) => ({ ...current, password: "" }));
                setNotice("");
              }}
            >
              {authMode === "login" ? "Register" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Main citizen/admin dashboard.
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>Huduma Murang’a</strong>
            <span>Public Service Portal</span>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <a className="nav-item active" href="#overview">
          ▦ <span>Overview</span>
        </a>
        <a className="nav-item" href="#requests">
          ☷ <span>Service requests</span>
        </a>
        <a className="nav-item" href="#submit-request">
          ＋ <span>Submit a request</span>
        </a>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">i</span>
            <strong>Need assistance?</strong>
            <p>
              Submit a request and keep its reference number for tracking.
            </p>
          </div>

          <div className="demo-user">
            <div className="avatar">{isAdmin ? "A" : "C"}</div>
            <div>
              <strong>
                {isAdmin ? "Administrator" : "Citizen portal"}
              </strong>
              <span>{session.user.email}</span>
            </div>
          </div>

          <button
            className="secondary-button logout-button"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Public portal <span>/</span> Overview
          </div>
          <div className="topbar-right">
            <span className="online-dot" />
            {isAdmin ? "Administrator mode" : "Citizen account"}
          </div>
        </header>

        <section className="page-heading" id="overview">
          <div>
            <p className="eyebrow">MURANG’A COUNTY GOVERNMENT</p>
            <h1>Public Service Requests</h1>
            <p className="subtitle">
              Submit, review and track requests for county services.
            </p>
          </div>
          <a className="primary-button heading-button" href="#submit-request">
            ＋ New request
          </a>
        </section>

        <section className="stats-grid" aria-label="Request statistics">
          <StatCard
            label="Total requests"
            value={stats.total}
            detail="Requests visible to your account"
            icon="▤"
            tone="blue"
          />
          <StatCard
            label="Open requests"
            value={stats.open}
            detail="Awaiting resolution"
            icon="◷"
            tone="amber"
          />
          <StatCard
            label="Pending review"
            value={stats.pending}
            detail="Awaiting initial action"
            icon="◌"
            tone="purple"
          />
          <StatCard
            label="Resolved requests"
            value={stats.resolved}
            detail="Successfully completed"
            icon="✓"
            tone="green"
          />
        </section>

        <section className="content-grid">
          <div className="panel request-panel" id="submit-request">
            <div className="panel-heading">
              <div>
                <h2>Submit a service request</h2>
                <p>
                  Provide details so the relevant team can review your request.
                </p>
              </div>
              <span className="heading-icon">＋</span>
            </div>

            <form onSubmit={handleSubmit} className="request-form">
              <label>
                Service category <span className="required">*</span>
                <select
                  value={form.service}
                  required
                  onChange={(event) =>
                    setForm({ ...form, service: event.target.value })
                  }
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Constituency <span className="required">*</span>
                <select
                  value={form.constituency}
                  required
                  onChange={(event) => {
                    const constituency = event.target.value;
                    setForm((current) => ({
                      ...current,
                      constituency,
                      ward: "",
                    }));
                  }}
                >
                  <option value="">Select constituency</option>
                  {Object.keys(wardsByConstituency).map((constituency) => (
                    <option key={constituency} value={constituency}>
                      {constituency}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Ward <span className="required">*</span>
                <select
                  value={form.ward}
                  required
                  disabled={!form.constituency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ward: event.target.value,
                    }))
                  }
                >
                  <option value="">Select ward</option>
                  {(wardsByConstituency[form.constituency] ?? []).map(
                    (ward) => (
                      <option key={ward} value={ward}>
                        {ward}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Village / road / market / landmark{" "}
                <span className="required">*</span>
                <input
                  value={form.location}
                  onChange={(event) =>
                    setForm({ ...form, location: event.target.value })
                  }
                  placeholder="e.g. near the local market"
                  maxLength={100}
                  required
                />
              </label>

              <label>
                Request description <span className="required">*</span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="Describe the issue or service you need..."
                  rows={4}
                  maxLength={1000}
                  required
                />
                <span className="field-hint">
                  {form.description.length}/1000 characters
                </span>
              </label>

              <label>
                Supporting image (optional)
                <input
                  key={imageInputKey}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;

                    if (!file) {
                      setSelectedImage(null);
                      return;
                    }

                    if (!allowedImageTypes.includes(file.type)) {
                      setSelectedImage(null);
                      setImageInputKey((current) => current + 1);
                      setNotice("Choose a JPG, PNG or WebP image.");
                      return;
                    }

                    if (file.size > MAX_IMAGE_SIZE) {
                      setSelectedImage(null);
                      setImageInputKey((current) => current + 1);
                      setNotice("The image must be 5 MB or smaller.");
                      return;
                    }

                    setSelectedImage(file);
                    setNotice("");
                  }}
                />
                <span className="field-hint">
                  JPG, PNG or WebP. Maximum size: 5 MB.
                </span>
                {selectedImage && (
                  <span className="field-hint">
                    Selected: {selectedImage.name}
                  </span>
                )}
              </label>

              <button
                className="primary-button submit-button"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? selectedImage
                    ? "Uploading image and submitting…"
                    : "Submitting…"
                  : "Submit request →"}
              </button>
            </form>
          </div>

          <div className="panel process-panel">
            <div className="panel-heading">
              <div>
                <h2>How it works</h2>
                <p>Follow your request through three stages.</p>
              </div>
            </div>

            <div className="process-step">
              <div className="step-number step-one">1</div>
              <div>
                <strong>Submit</strong>
                <p>
                  Send your request with the service category and location.
                </p>
              </div>
            </div>
            <div className="process-line" />

            <div className="process-step">
              <div className="step-number step-two">2</div>
              <div>
                <strong>Under review</strong>
                <p>
                  The responsible team reviews and works on the issue.
                </p>
              </div>
            </div>
            <div className="process-line" />

            <div className="process-step">
              <div className="step-number step-three">3</div>
              <div>
                <strong>Resolved</strong>
                <p>Check the status for the latest outcome.</p>
              </div>
            </div>

            <div className="info-note">
              <span>ⓘ</span>
              <p>
                Keep your request reference number so you can identify it
                later.
              </p>
            </div>
          </div>
        </section>

        <section className="panel table-panel" id="requests">
          <div className="panel-heading table-heading">
            <div>
              <h2>Service requests</h2>
              <p>
                {isAdmin
                  ? "Review and manage submitted requests."
                  : "Track requests submitted by your account."}
              </p>
            </div>
            <span className="result-count">
              {visibleRequests.length} records
            </span>
          </div>

          <div className="table-tools">
            <div className="search-box">
              <span>⌕</span>
              <input
                aria-label="Search requests"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search requests..."
              />
            </div>

            <select
              aria-label="Filter by status"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>REFERENCE</th>
                  <th>SERVICE / DESCRIPTION</th>
                  <th>LOCATION</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                  {isAdmin && <th>ADMIN ACTION</th>}
                </tr>
              </thead>

              <tbody>
                {loadingRequests && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      className="empty-state"
                    >
                      Loading requests…
                    </td>
                  </tr>
                )}

                {!loadingRequests &&
                  visibleRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong className="reference">{request.id}</strong>
                      </td>

                      <td>
                        <strong>{request.service}</strong>
                        <span className="description-cell">
                          {request.description}
                        </span>
                      </td>

                      <td>
                        {request.ward && request.constituency ? (
                          <>
                            <strong>
                              {request.ward}, {request.constituency}
                            </strong>
                            <span className="description-cell">
                              {request.location}
                            </span>
                          </>
                        ) : (
                          request.location
                        )}

                        {request.imageUrl && (
                          <a
                            className="attachment-link"
                            href={request.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View image
                          </a>
                        )}
                      </td>

                      <td>{request.date}</td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>

                      {isAdmin && (
                        <td>
                          <select
                            aria-label={`Update status for ${request.id}`}
                            value={request.status}
                            onChange={(event) =>
                              updateStatus(request.id, event.target.value)
                            }
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}

                {!loadingRequests && visibleRequests.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      className="empty-state"
                    >
                      No requests match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}

          <p className="demo-note">
            {isAdmin
              ? "Administrator access is checked against the app_admins table."
              : "You are viewing requests permitted by your account's database access rules."}
          </p>
        </section>

        <footer className="footer">
          <span>
            © 2026 Huduma Murang’a · Public Service Request System
          </span>
          <span>Built for service access and accountability</span>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ label, value, detail, icon, tone }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}

function StatusBadge({ status }) {
  const className = status.toLowerCase().replace(" ", "-");

  return <span className={`status-badge ${className}`}>{status}</span>;
}

export default App;
