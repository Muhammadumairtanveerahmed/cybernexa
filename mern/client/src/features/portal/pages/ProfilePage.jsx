import { useEffect, useState } from "react";
import api from "../../../api/axios.js";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import { initials } from "../../../utils/format.js";

export default function ProfilePage() {
  const { user: authUser, refresh } = useAuth();
  const { data, loading, error, reload } = useFetch(portalApi.profile, []);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [password, setPassword] = useState({ current_password: "", new_password: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (data) {
      setForm({
        ...data.user,
        ...data.profile
      });
    }
  }, [data]);

  if (loading) {
    return (
      <PortalPage title="My Profile" sub="Loading your profile...">
        <div className="loading">
          <i className="fa-solid fa-spinner fa-spin" /> Loading...
        </div>
      </PortalPage>
    );
  }

  if (error) {
    return (
      <PortalPage title="My Profile" sub="Account details">
        <div className="err">{error}</div>
      </PortalPage>
    );
  }

  const role = authUser?.role || "student";
  const photo = data?.user?.photo_url || data?.user?.photo || "";
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await portalApi.updateProfile(form);
      setMessage("Profile saved.");
      await reload();
      await refresh();
    } catch (err) {
      setMessage(err.message || "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("avatar", file);
    setAvatarBusy(true);
    setMessage("");
    try {
      await portalApi.uploadAvatar(body);
      setMessage("Photo updated.");
      await reload();
      await refresh();
    } catch (err) {
      setMessage(err.message || "Could not upload the photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    if (password.new_password !== password.confirm) {
      setPasswordMessage("New passwords do not match.");
      return;
    }
    try {
      await api.post("/auth/change-password", {
        current_password: password.current_password,
        new_password: password.new_password
      });
      setPasswordMessage("Password changed.");
      setPassword({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      setPasswordMessage(err.message || "Could not change the password.");
    }
  };

  return (
    <PortalPage title="My Profile" sub="Keep your personal and academic details up to date.">
      {message ? <div className={message.includes("saved") || message.includes("updated") ? "ok" : "err"}>{message}</div> : null}

      <div className="panel">
        <h2>Account</h2>
        <div className="inline" style={{ marginBottom: 18 }}>
          {photo ? (
            <span className="avatar lg">
              <img src={photo} alt={data?.user?.full_name || "Profile"} />
            </span>
          ) : (
            <span className="avatar lg">{initials(data?.user?.full_name)}</span>
          )}
          <div>
            <b>{data?.user?.full_name}</b>
            <div className="muted-sm">
              {role} · {data?.user?.email}
            </div>
            <div className="muted-sm">
              Member since {formatDate(data?.user?.created_at)}
            </div>
          </div>
        </div>
        <label htmlFor="avatar">Profile photo</label>
        <input id="avatar" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={uploadAvatar} disabled={avatarBusy} />
        <p className="form-note">JPG, PNG or WebP. The image is shown on your profile and in messages.</p>
      </div>

      <form className="panel" onSubmit={save}>
        <h2>Personal details</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="full_name">Full name</label>
            <input id="full_name" value={form.full_name || ""} onChange={(event) => update("full_name", event.target.value)} />
          </div>
          <div>
            <label htmlFor="phone">Phone</label>
            <input id="phone" value={form.phone || ""} onChange={(event) => update("phone", event.target.value)} placeholder="03xx xxxxxxx" />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" value={form.email || ""} disabled />
          </div>
        </div>

        {role === "student" ? (
          <>
            <h2 style={{ marginTop: 22 }}>Student details</h2>
            <div className="form-grid">
              <div>
                <label htmlFor="dob">Date of birth</label>
                <input id="dob" type="date" value={form.dob || ""} onChange={(event) => update("dob", event.target.value)} />
              </div>
              <div>
                <label htmlFor="gender">Gender</label>
                <select id="gender" value={form.gender || ""} onChange={(event) => update("gender", event.target.value)}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="cnic">CNIC / B-Form</label>
                <input id="cnic" value={form.cnic || ""} onChange={(event) => update("cnic", event.target.value)} placeholder="xxxxx-xxxxxxx-x" />
              </div>
              <div>
                <label htmlFor="city">City</label>
                <input id="city" value={form.city || ""} onChange={(event) => update("city", event.target.value)} />
              </div>
              <div>
                <label htmlFor="last_qualification">Last qualification</label>
                <input id="last_qualification" value={form.last_qualification || ""} onChange={(event) => update("last_qualification", event.target.value)} />
              </div>
              <div>
                <label htmlFor="guardian_name">Guardian name</label>
                <input id="guardian_name" value={form.guardian_name || ""} onChange={(event) => update("guardian_name", event.target.value)} />
              </div>
              <div>
                <label htmlFor="guardian_phone">Guardian phone</label>
                <input id="guardian_phone" value={form.guardian_phone || ""} onChange={(event) => update("guardian_phone", event.target.value)} />
              </div>
              <div>
                <label htmlFor="interests">Interests</label>
                <input id="interests" value={form.interests || ""} onChange={(event) => update("interests", event.target.value)} placeholder="Cybersecurity, cloud, networking" />
              </div>
            </div>
            <label htmlFor="address">Address</label>
            <textarea id="address" rows={3} value={form.address || ""} onChange={(event) => update("address", event.target.value)} />
          </>
        ) : null}

        {role === "teacher" ? (
          <>
            <h2 style={{ marginTop: 22 }}>Teacher details</h2>
            <div className="form-grid">
              <div>
                <label htmlFor="qualification">Qualification</label>
                <input id="qualification" value={form.qualification || ""} onChange={(event) => update("qualification", event.target.value)} />
              </div>
              <div>
                <label htmlFor="expertise">Expertise</label>
                <input id="expertise" value={form.expertise || ""} onChange={(event) => update("expertise", event.target.value)} />
              </div>
              <div>
                <label htmlFor="experience_years">Experience (years)</label>
                <input id="experience_years" type="number" min="0" max="60" value={form.experience_years || 0} onChange={(event) => update("experience_years", event.target.value)} />
              </div>
              <div>
                <label htmlFor="expected_fee">Expected fee</label>
                <input id="expected_fee" value={form.expected_fee || ""} onChange={(event) => update("expected_fee", event.target.value)} />
              </div>
              <div>
                <label htmlFor="availability">Availability</label>
                <input id="availability" value={form.availability || ""} onChange={(event) => update("availability", event.target.value)} placeholder="Evenings, weekends" />
              </div>
              <div>
                <label htmlFor="portfolio_url">Portfolio / LinkedIn</label>
                <input id="portfolio_url" value={form.portfolio_url || ""} onChange={(event) => update("portfolio_url", event.target.value)} />
              </div>
            </div>
            <label htmlFor="bio">Bio</label>
            <textarea id="bio" rows={4} value={form.bio || ""} onChange={(event) => update("bio", event.target.value)} />
            {form.cv_file ? (
              <p className="form-note">
                CV on file: <a href={form.cv_file} target="_blank" rel="noreferrer" style={{ color: "var(--acc)" }}>open CV</a>
              </p>
            ) : null}
          </>
        ) : null}

        <button className="btn primary" type="submit" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? "Saving..." : "Save profile"}
        </button>
      </form>

      <form className="panel" onSubmit={changePassword}>
        <h2>Change password</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="current_password">Current password</label>
            <input id="current_password" type="password" value={password.current_password} onChange={(event) => setPassword((current) => ({ ...current, current_password: event.target.value }))} required />
          </div>
          <div>
            <label htmlFor="new_password">New password</label>
            <input id="new_password" type="password" value={password.new_password} onChange={(event) => setPassword((current) => ({ ...current, new_password: event.target.value }))} required />
          </div>
          <div>
            <label htmlFor="confirm_password">Confirm new password</label>
            <input id="confirm_password" type="password" value={password.confirm} onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))} required />
          </div>
        </div>
        {passwordMessage ? <p className={passwordMessage.includes("changed") ? "ok" : "err"} style={{ marginTop: 12 }}>{passwordMessage}</p> : null}
        <button className="btn primary" type="submit" style={{ marginTop: 14 }}>
          Update password
        </button>
      </form>
    </PortalPage>
  );
}
