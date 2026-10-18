
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

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [form, setForm] = useState({
    service: categories[0],
    location: "",
    description: "",
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Restore the signed-in session and listen for login/logout changes.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice(error.message);
      setSession(data?.session ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (active) {
        setSession(newSession);
        setAuthReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load the user's requests and check whether the user is an administrator.
  useEffect(() => {
    let active = true;

    async function loadPortalData() {
      const user = session?.user;

      if (!user) {
        setRequests([]);
        setIsAdmin(false);
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
              "reference_number, service_category, location, description, status, created_at"
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

        setIsAdmin(Boolean(adminResult.data));
        setRequests(
          (requestResult.data ?? []).map((row) => ({
            id: row.reference_number,
            service: row.service_category,
            location: row.location,
            description: row.description,
            status: row.status,
            date: row.created_at
              ? new Date(row.created_at).toLocaleDateString("en-CA")
              : "",
          }))
        );
      } catch (error) {
        if (active) setNotice(error.message);
      } finally {
        if (active) setLoadingRequests(false);
      }
    }

    loadPortalData();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      open: requests.filter((r) => r.status !== "Resolved").length,
      pending: requests.filter((r) => r.status === "Pending").length,
      resolved: requests.filter((r) => r.status === "Resolved").length,
    }),
    [requests]
  );

  const visibleRequests = requests.filter((request) => {
    const matchesFilter = filter === "All" || request.status === filter;
    const query = search.toLowerCase();

    const matchesSearch = [
      request.id,
      request.service,
      request.location,
      request.description,
    ].some((value) => value.toLowerCase().includes(query));

    return matchesFilter && matchesSearch;
  });

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");

    try {
      const email = authForm.email.trim().toLowerCase();
      const password = authForm.password;

      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          setNotice("Account created. You are now signed in.");
        } else {
          setNotice(
            "Registration received. Check your email for a confirmation link before signing in."
          );
          setAuthMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

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
      setNotice("You have signed out.");
      setRequests([]);
      setIsAdmin(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.location.trim() || !form.description.trim()) {
      setNotice("Please enter the location and describe your request.");
      return;
    }

    const user = session?.user;

    if (!user) {
      setNotice("Please sign in before submitting a request.");
      return;
    }

    setBusy(true);
    setNotice("");

    const referenceNumber = `MUR-${Date.now()}`;

    try {
      const { data, error } = await supabase
        .from("service_requests")
        .insert({
          reference_number: referenceNumber,
          user_id: user.id,
          service_category: form.service,
          location: form.location.trim(),
          description: form.description.trim(),
          status: "Pending",
        })
        .select(
          "reference_number, service_category, location, description, status, created_at"
        )
        .single();

      if (error) throw error;

      const newRequest = {
        id: data.reference_number,
        service: data.service_category,
        location: data.location,
        description: data.description,
        status: data.status,
        date: new Date(data.created_at).toLocaleDateString("en-CA"),
      };

      setRequests((current) => [newRequest, ...current]);
      setForm({
        service: categories[0],
        location: "",
        description: "",
      });
      setNotice(`Request ${data.reference_number} submitted successfully.`);
      setFilter("All");
      setSearch("");
    } catch (error) {
      setNotice(`Could not submit request: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

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
    return <div className="auth-screen"><div className="auth-card">Connecting to the service portal…</div></div>;
  }

  if (!session) {
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
          <h1>{authMode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="subtitle">
            {authMode === "login"
              ? "Sign in to submit and track your service requests."
              : "Register to access the public service portal."}
          </p>

          <form onSubmit={handleAuthSubmit} className="request-form">
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

            <label>
              Password
              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm({ ...authForm, password: event.target.value })
                }
                placeholder="At least 6 characters"
              />
            </label>

            <button className="primary-button submit-button" type="submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : authMode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          {notice && <p className="notice" role="status">{notice}</p>}

          <p className="auth-switch">
            {authMode === "login"
              ? "Don't have an account?"
              : "Already registered?"}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
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
        <a className="nav-item active" href="#overview">▦ <span>Overview</span></a>
        <a className="nav-item" href="#requests">☷ <span>Service requests</span></a>
        <a className="nav-item" href="#submit-request">＋ <span>Submit a request</span></a>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">i</span>
            <strong>Need assistance?</strong>
            <p>Submit a request and keep its reference number for tracking.</p>
          </div>
          <div className="demo-user">
            <div className="avatar">{isAdmin ? "A" : "C"}</div>
            <div>
              <strong>{isAdmin ? "Administrator" : "Citizen portal"}</strong>
              <span>{session.user.email}</span>
            </div>
          </div>
          <button className="secondary-button logout-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Public portal <span>/</span> Overview</div>
          <div className="topbar-right">
            <span className="online-dot" /> {isAdmin ? "Administrator mode" : "Citizen account"}
          </div>
        </header>

        <section className="page-heading" id="overview">
          <div>
            <p className="eyebrow">MURANG’A COUNTY GOVERNMENT</p>
            <h1>Public Service Requests</h1>
            <p className="subtitle">Submit, review and track requests for county services.</p>
          </div>
          <a className="primary-button heading-button" href="#submit-request">＋ New request</a>
        </section>

        <section className="stats-grid" aria-label="Request statistics">
          <StatCard label="Total requests" value={stats.total} detail="Requests visible to your account" icon="▤" tone="blue" />
          <StatCard label="Open requests" value={stats.open} detail="Awaiting resolution" icon="◷" tone="amber" />
          <StatCard label="Pending review" value={stats.pending} detail="Awaiting initial action" icon="◌" tone="purple" />
          <StatCard label="Resolved requests" value={stats.resolved} detail="Successfully completed" icon="✓" tone="green" />
        </section>

        <section className="content-grid">
          <div className="panel request-panel" id="submit-request">
            <div className="panel-heading">
              <div>
                <h2>Submit a service request</h2>
                <p>Provide details so the relevant team can review your request.</p>
              </div>
              <span className="heading-icon">＋</span>
            </div>

            <form onSubmit={handleSubmit} className="request-form">
              <label>
                Service category <span className="required">*</span>
                <select
                  value={form.service}
                  onChange={(event) => setForm({ ...form, service: event.target.value })}
                >
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>

              <label>
                Location / ward <span className="required">*</span>
                <input
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="e.g. Kiharu, Kangema"
                  maxLength={100}
                  required
                />
              </label>

              <label>
                Request description <span className="required">*</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Describe the issue or service you need..."
                  rows={4}
                  maxLength={1000}
                  required
                />
                <span className="field-hint">{form.description.length}/1000 characters</span>
              </label>

              <button className="primary-button submit-button" type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Submit request →"}
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
              <div><strong>Submit</strong><p>Send your request with the service category and location.</p></div>
            </div>
            <div className="process-line" />
            <div className="process-step">
              <div className="step-number step-two">2</div>
              <div><strong>Under review</strong><p>The responsible team reviews and works on the issue.</p></div>
            </div>
            <div className="process-line" />
            <div className="process-step">
              <div className="step-number step-three">3</div>
              <div><strong>Resolved</strong><p>Check the status for the latest outcome.</p></div>
            </div>
            <div className="info-note"><span>ⓘ</span><p>Keep your request reference number so you can identify it later.</p></div>
          </div>
        </section>

        <section className="panel table-panel" id="requests">
          <div className="panel-heading table-heading">
            <div>
              <h2>Service requests</h2>
              <p>{isAdmin ? "Review and manage submitted requests." : "Track requests submitted by your account."}</p>
            </div>
            <span className="result-count">{visibleRequests.length} records</span>
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
            <select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option>All</option>
              <option>Pending</option>
              <option>In Progress</option>
              <option>Resolved</option>
            </select>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>REFERENCE</th><th>SERVICE / DESCRIPTION</th><th>LOCATION</th><th>DATE</th><th>STATUS</th>
                  {isAdmin && <th>ADMIN ACTION</th>}
                </tr>
              </thead>
              <tbody>
                {loadingRequests && (
                  <tr><td colSpan={isAdmin ? 6 : 5} className="empty-state">Loading requests…</td></tr>
                )}
                {!loadingRequests && visibleRequests.map((request) => (
                  <tr key={request.id}>
                    <td><strong className="reference">{request.id}</strong></td>
                    <td><strong>{request.service}</strong><span className="description-cell">{request.description}</span></td>
                    <td>{request.location}</td>
                    <td>{request.date}</td>
                    <td><StatusBadge status={request.status} /></td>
                    {isAdmin && (
                      <td>
                        <select
                          aria-label={`Update status for ${request.id}`}
                          value={request.status}
                          onChange={(event) => updateStatus(request.id, event.target.value)}
                        >
                          <option>Pending</option>
                          <option>In Progress</option>
                          <option>Resolved</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
                {!loadingRequests && visibleRequests.length === 0 && (
                  <tr><td colSpan={isAdmin ? 6 : 5} className="empty-state">No requests match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {notice && <p className="notice" role="status">{notice}</p>}
          <p className="demo-note">
            {isAdmin
              ? "Administrator access is checked against the app_admins table."
              : "You are viewing requests permitted by your account's database access rules."}
          </p>
        </section>

        <footer className="footer">
          <span>© 2026 Huduma Murang’a · Public Service Request System</span>
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
