import { useEffect, useMemo, useRef, useState } from "react";
import { useApi, baseUrl } from "coffeebreak";
import { useNotification } from "coffeebreak/contexts";
import {
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
} from "react-icons/fi";

const PLUGIN = "coffeebreak-point-system-plugin";
const TEMPLATES_URL = `${baseUrl}/${PLUGIN}/transaction-template`;
const POINT_SYSTEM_URL = `${baseUrl}/${PLUGIN}/point-system`;
const USERS_URL = `${baseUrl}/users/`;
const ROLES_URL = `${baseUrl}/users/roles/`;
const ACTIVITIES_URL = `${baseUrl}/activities/`;

function toNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {subtitle ? <p className="text-sm text-base-content/70 mt-1">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function Modal({ isOpen, onClose, title, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (isOpen) {
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [isOpen]);

  return (
    <dialog ref={ref} className="modal" onCancel={(event) => event.preventDefault()}>
      <div className="modal-box max-w-2xl">
        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={onClose}>
          x
        </button>
        <h3 className="font-bold text-lg mb-4">{title}</h3>
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

function UserSelectField({
  users,
  value,
  onChange,
  placeholder = "Select user",
  required = false,
  allowEmpty = true,
}) {
  if (!users.length) {
    return (
      <input
        className="input input-bordered input-sm w-full"
        type="text"
        placeholder="User identifier"
        value={value}
        onChange={onChange}
        required={required}
      />
    );
  }

  return (
    <select className="select select-bordered select-sm w-full" value={value} onChange={onChange} required={required}>
      {allowEmpty ? <option value="">{placeholder}</option> : null}
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.label}
        </option>
      ))}
    </select>
  );
}

function RoleSelectField({ roles, value, onChange, placeholder = "Select role", allowEmpty = true }) {
  if (!roles.length) {
    return (
      <input
        className="input input-bordered input-sm w-full"
        type="text"
        placeholder="Role name"
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <select className="select select-bordered select-sm w-full" value={value} onChange={onChange}>
      {allowEmpty ? <option value="">{placeholder}</option> : null}
      {roles.map((role) => (
        <option key={role.name} value={role.name}>
          {role.label}
        </option>
      ))}
    </select>
  );
}

function ActivitySelectField({
  activities,
  value,
  onChange,
  placeholder = "Activity",
  className = "select select-bordered select-sm w-full",
  allowEmpty = true,
}) {
  if (!activities.length) {
    return (
      <input
        className="input input-bordered input-sm w-full"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <select className={className} value={value} onChange={onChange}>
      {allowEmpty ? <option value="">{placeholder}</option> : null}
      {activities.map((activity) => (
        <option key={activity.id} value={String(activity.id)}>
          {activity.name}
        </option>
      ))}
    </select>
  );
}

function TemplateForm({ initial, activities, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: "",
    points_mode: "automatic",
    points: 0,
    activity_id: "",
    description: "",
    claim_limit: 0,
  });

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? "",
        points_mode: initial.points_mode ?? "automatic",
        points: initial.points ?? 0,
        activity_id: initial.activity_id ? String(initial.activity_id) : "",
        description: initial.description ?? "",
        claim_limit: initial.claim_limit ?? 0,
      });
      return;
    }

    setForm({
      name: "",
      points_mode: "automatic",
      points: 0,
      activity_id: "",
      description: "",
      claim_limit: 0,
    });
  }, [initial]);

  const updateField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      points: form.points_mode === "manual" ? 0 : Number(form.points),
      activity_id: form.activity_id ? Number(form.activity_id) : null,
      claim_limit: form.claim_limit ? Number(form.claim_limit) : 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-control">
        <label className="label">
          <span className="label-text">Name</span>
        </label>
        <input className="input input-bordered w-full" value={form.name} onChange={updateField("name")} required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Points Mode</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={form.points_mode}
            onChange={updateField("points_mode")}
          >
            <option value="automatic">Automatic (template points)</option>
            <option value="manual">Manual (staff enters points)</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Activity</span>
          </label>
          <ActivitySelectField
            activities={activities}
            value={form.activity_id}
            onChange={updateField("activity_id")}
            placeholder="No activity"
            className="select select-bordered w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Points</span>
          </label>
          <input
            className="input input-bordered w-full"
            type="number"
            min="0"
            step="1"
            value={form.points}
            onChange={updateField("points")}
            required={form.points_mode === "automatic"}
            disabled={form.points_mode === "manual"}
          />
          {form.points_mode === "manual" ? (
            <span className="label-text-alt text-base-content/60 mt-1">
              Points are entered by staff after scan.
            </span>
          ) : null}
        </div>
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Description</span>
        </label>
        <textarea
          className="textarea textarea-bordered w-full"
          rows={2}
          value={form.description || ""}
          onChange={updateField("description")}
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Claim Limit (0 = unlimited)</span>
        </label>
        <input
          className="input input-bordered w-full"
          type="number"
          min="0"
          value={form.claim_limit}
          onChange={updateField("claim_limit")}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {initial ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

function PrivilegedActions({ api, showNotification, templates, activities, users, onActionComplete }) {
  const [busyAction, setBusyAction] = useState("");

  const [manualForm, setManualForm] = useState({
    user_id: "",
    points: "",
    transaction_type: "manual",
    activity_id: "",
    description: "",
  });

  const [removeForm, setRemoveForm] = useState({
    user_id: "",
    points: "",
    description: "",
    activity_id: "",
  });

  const [templateForm, setTemplateForm] = useState({
    template_id: "",
    user_id: "",
  });

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.id) === templateForm.template_id),
    [templates, templateForm.template_id]
  );

  const activityById = useMemo(() => {
    const map = new Map();
    activities.forEach((activity) => {
      map.set(String(activity.id), activity.name);
    });
    return map;
  }, [activities]);

  const updateManual = (key) => (event) => {
    setManualForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const updateManualTransactionType = (event) => {
    const nextType = event.target.value;
    setManualForm((prev) => ({
      ...prev,
      transaction_type: nextType,
      activity_id: nextType === "activity" ? prev.activity_id : "",
    }));
  };

  const updateRemove = (key) => (event) => {
    setRemoveForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const updateTemplate = (key) => (event) => {
    setTemplateForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    const points = toNumber(manualForm.points);

    if (!manualForm.user_id.trim() || points === null) {
      showNotification("User and points are required", "error");
      return;
    }

    if (manualForm.transaction_type === "activity" && toNumber(manualForm.activity_id) === null) {
      showNotification("Activity transactions require an activity", "error");
      return;
    }

    const payload = {
      activity_id: toNumber(manualForm.activity_id),
      points,
      description: manualForm.description.trim() || null,
    };

    setBusyAction("manual");
    try {
      await api.post(
        `${POINT_SYSTEM_URL}/points/${encodeURIComponent(manualForm.user_id.trim())}/add?transaction_type=${manualForm.transaction_type}`,
        payload
      );
      showNotification("Manual transaction executed", "success");
      setManualForm({
        user_id: "",
        points: "",
        transaction_type: "manual",
        activity_id: "",
        description: "",
      });
      await onActionComplete();
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to execute manual transaction", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleRemoveSubmit = async (event) => {
    event.preventDefault();
    const points = toNumber(removeForm.points);

    if (!removeForm.user_id.trim() || points === null || !removeForm.description.trim()) {
      showNotification("User, points and reason are required", "error");
      return;
    }

    const params = new URLSearchParams({
      points: String(points),
      description: removeForm.description.trim(),
    });

    if (removeForm.activity_id) {
      params.set("activity_id", removeForm.activity_id);
    }

    setBusyAction("remove");
    try {
      await api.post(
        `${POINT_SYSTEM_URL}/points/${encodeURIComponent(removeForm.user_id.trim())}/remove?${params.toString()}`
      );
      showNotification("Points removed successfully", "success");
      setRemoveForm({ user_id: "", points: "", description: "", activity_id: "" });
      await onActionComplete();
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to remove points", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleExecuteTemplate = async (event) => {
    event.preventDefault();
    if (!templateForm.template_id || !templateForm.user_id.trim()) {
      showNotification("Template and user are required", "error");
      return;
    }

    if (selectedTemplate?.points_mode === "manual") {
      showNotification(
        "This template requires manual points input and cannot be executed from this panel.",
        "error"
      );
      return;
    }

    setBusyAction("template");
    try {
      await api.post(`${TEMPLATES_URL}/${templateForm.template_id}/execute`, {
        user_id: templateForm.user_id.trim(),
      });
      showNotification("Template executed successfully", "success");
      setTemplateForm((prev) => ({ ...prev, user_id: "" }));
      await onActionComplete();
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to execute template", "error");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <Panel title="Privileged Operations" subtitle="Execute point transactions and templates with strict controls.">
      <div className="alert alert-warning py-2">
        <FiShield className="shrink-0" />
        <span className="text-sm">These actions update points immediately.</span>
      </div>

      {!users.length ? (
        <div className="alert alert-info py-2">
          <span className="text-sm">User directory not available. Enter the user identifier manually.</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="border border-base-300 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">Manual Add</h3>
          <form className="space-y-2" onSubmit={handleManualSubmit}>
            <UserSelectField
              users={users}
              value={manualForm.user_id}
              onChange={updateManual("user_id")}
              placeholder="Select user"
              required
              allowEmpty={false}
            />

            <input
              className="input input-bordered input-sm w-full"
              placeholder="Points"
              type="number"
              step="any"
              value={manualForm.points}
              onChange={updateManual("points")}
            />

            <select
              className="select select-bordered select-sm w-full"
              value={manualForm.transaction_type}
              onChange={updateManualTransactionType}
            >
              <option value="manual">Manual</option>
              <option value="activity">Activity</option>
            </select>

            {manualForm.transaction_type === "activity" ? (
              <ActivitySelectField
                activities={activities}
                value={manualForm.activity_id}
                onChange={updateManual("activity_id")}
                placeholder="Activity"
                allowEmpty
              />
            ) : null}

            <textarea
              className="textarea textarea-bordered textarea-sm w-full"
              rows={2}
              placeholder="Reason / description"
              value={manualForm.description}
              onChange={updateManual("description")}
            />

            <button className="btn btn-primary btn-sm w-full" disabled={busyAction === "manual"}>
              {busyAction === "manual" ? "Executing..." : "Execute Add"}
            </button>
          </form>
        </div>

        <div className="border border-base-300 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">Manual Remove</h3>
          <form className="space-y-2" onSubmit={handleRemoveSubmit}>
            <UserSelectField
              users={users}
              value={removeForm.user_id}
              onChange={updateRemove("user_id")}
              placeholder="Select user"
              required
              allowEmpty={false}
            />

            <input
              className="input input-bordered input-sm w-full"
              placeholder="Points"
              type="number"
              step="any"
              value={removeForm.points}
              onChange={updateRemove("points")}
            />

            <ActivitySelectField
              activities={activities}
              value={removeForm.activity_id}
              onChange={updateRemove("activity_id")}
              placeholder="Activity (optional)"
              allowEmpty
            />

            <textarea
              className="textarea textarea-bordered textarea-sm w-full"
              rows={3}
              placeholder="Required reason"
              value={removeForm.description}
              onChange={updateRemove("description")}
            />

            <button className="btn btn-error btn-sm w-full" disabled={busyAction === "remove"}>
              {busyAction === "remove" ? "Executing..." : "Execute Removal"}
            </button>
          </form>
        </div>

        <div className="border border-base-300 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">Execute Template</h3>
          <form className="space-y-2" onSubmit={handleExecuteTemplate}>
            <select
              className="select select-bordered select-sm w-full"
              value={templateForm.template_id}
              onChange={updateTemplate("template_id")}
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>

            <UserSelectField
              users={users}
              value={templateForm.user_id}
              onChange={updateTemplate("user_id")}
              placeholder="Select user"
              required
              allowEmpty={false}
            />

            <div className="rounded-lg border border-base-300 p-3 text-sm">
              {selectedTemplate ? (
                <div className="space-y-1">
                  <div>
                    <span className="text-base-content/60">Mode:</span>{" "}
                    {selectedTemplate.points_mode === "manual" ? "Manual" : "Automatic"}
                  </div>
                  <div>
                    <span className="text-base-content/60">Points:</span>{" "}
                    {selectedTemplate.points_mode === "manual"
                      ? "Entered by staff at execution time"
                      : selectedTemplate.points}
                  </div>
                  <div>
                    <span className="text-base-content/60">Activity:</span>{" "}
                    {selectedTemplate.activity_id
                      ? activityById.get(String(selectedTemplate.activity_id)) || selectedTemplate.activity_id
                      : "-"}
                  </div>
                  <div>
                    <span className="text-base-content/60">Description:</span> {selectedTemplate.description || "-"}
                  </div>
                </div>
              ) : (
                <span className="text-base-content/60">Select a template to preview strict execution values.</span>
              )}
            </div>

            <button
              className="btn btn-secondary btn-sm w-full"
              disabled={busyAction === "template" || selectedTemplate?.points_mode === "manual"}
            >
              {busyAction === "template" ? "Executing..." : "Execute Template"}
            </button>
          </form>
        </div>
      </div>
    </Panel>
  );
}

function TransactionLogsPanel({ transactions, loading, onRefresh }) {
  return (
    <Panel
      title="Transaction Log"
      subtitle="Latest transactions under the active context."
      actions={
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
          <FiRefreshCw className="mr-1" /> Refresh
        </button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-base-content/70">No transactions found for the selected filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Points</th>
                <th>Type</th>
                <th>Activity</th>
                <th>Description</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.id}</td>
                  <td className="font-medium">{transaction.user_id}</td>
                  <td className={transaction.points < 0 ? "text-error" : "text-success"}>{transaction.points}</td>
                  <td>
                    <span className="badge badge-outline badge-sm">{transaction.transaction_type}</span>
                  </td>
                  <td>{transaction.activity_id ?? "-"}</td>
                  <td className="max-w-[14rem] truncate">{transaction.description || "-"}</td>
                  <td>{formatTimestamp(transaction.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function LeaderboardPanel({ entries, loading, onRefresh }) {
  return (
    <Panel
      title="Leaderboard"
      subtitle="Ranking for global scope or selected activity."
      actions={
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
          <FiRefreshCw className="mr-1" /> Refresh
        </button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-base-content/70">No leaderboard entries for the selected filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.id} className={index < 3 ? "font-semibold" : ""}>
                  <td>{index + 1}</td>
                  <td>{entry.id}</td>
                  <td>{entry.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function TemplatesSection({
  api,
  showNotification,
  templates,
  setTemplates,
  activities,
  users,
  roles,
  loading,
  refreshTemplates,
}) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsTemplate, setPermissionsTemplate] = useState(null);
  const [permissions, setPermissions] = useState({ user_subs: [], role_names: [] });
  const [newUserSub, setNewUserSub] = useState("");
  const [newRoleName, setNewRoleName] = useState("");

  const filteredTemplates = useMemo(
    () => templates.filter((template) => template.name.toLowerCase().includes(search.toLowerCase())),
    [templates, search]
  );

  const handleCreate = async (payload) => {
    try {
      const { data } = await api.post(TEMPLATES_URL, payload);
      setTemplates((prev) => [...prev, data]);
      setModalOpen(false);
      showNotification("Template created", "success");
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to create template", "error");
    }
  };

  const handleUpdate = async (payload) => {
    if (!editingTemplate) {
      return;
    }
    try {
      const { data } = await api.patch(`${TEMPLATES_URL}/${editingTemplate.id}`, payload);
      setTemplates((prev) => prev.map((template) => (template.id === editingTemplate.id ? data : template)));
      setEditingTemplate(null);
      setModalOpen(false);
      showNotification("Template updated", "success");
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to update template", "error");
    }
  };

  const handleDelete = async (templateId) => {
    if (!confirm("Delete this template?")) {
      return;
    }

    try {
      await api.delete(`${TEMPLATES_URL}/${templateId}`);
      setTemplates((prev) => prev.filter((template) => template.id !== templateId));
      showNotification("Template deleted", "success");
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to delete template", "error");
    }
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };

  const openPermissions = async (template) => {
    setPermissionsTemplate(template);
    setPermissionsModalOpen(true);
    setPermissionsLoading(true);
    setNewUserSub("");
    setNewRoleName("");
    try {
      const { data } = await api.get(`${TEMPLATES_URL}/${template.id}/permissions`);
      setPermissions(data);
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to load template permissions", "error");
      setPermissions({ user_subs: [], role_names: [] });
    } finally {
      setPermissionsLoading(false);
    }
  };

  const addUserPermission = async () => {
    if (!permissionsTemplate || !newUserSub.trim()) {
      return;
    }
    try {
      const { data } = await api.post(`${TEMPLATES_URL}/${permissionsTemplate.id}/permissions/users`, {
        user_sub: newUserSub.trim(),
      });
      setPermissions(data);
      setNewUserSub("");
      showNotification("User permission added", "success");
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to add user permission", "error");
    }
  };

  const removeUserPermission = async (userSub) => {
    if (!permissionsTemplate) {
      return;
    }
    try {
      const { data } = await api.delete(
        `${TEMPLATES_URL}/${permissionsTemplate.id}/permissions/users/${encodeURIComponent(userSub)}`
      );
      setPermissions(data);
      showNotification("User permission removed", "success");
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to remove user permission", "error");
    }
  };

  const addRolePermission = async () => {
    if (!permissionsTemplate || !newRoleName.trim()) {
      return;
    }
    try {
      const { data } = await api.post(`${TEMPLATES_URL}/${permissionsTemplate.id}/permissions/roles`, {
        role_name: newRoleName.trim(),
      });
      setPermissions(data);
      setNewRoleName("");
      showNotification("Role permission added", "success");
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to add role permission", "error");
    }
  };

  const removeRolePermission = async (roleName) => {
    if (!permissionsTemplate) {
      return;
    }
    try {
      const { data } = await api.delete(
        `${TEMPLATES_URL}/${permissionsTemplate.id}/permissions/roles/${encodeURIComponent(roleName)}`
      );
      setPermissions(data);
      showNotification("Role permission removed", "success");
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to remove role permission", "error");
    }
  };

  return (
    <Panel
      title="Transaction Templates"
      subtitle="Manage reusable templates for strict privileged execution."
      actions={
        <>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
            <input
              className="input input-bordered input-sm pl-9 w-44"
              placeholder="Search templates"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={refreshTemplates}>
            <FiRefreshCw className="mr-1" /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <FiPlus className="mr-1" /> New
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <p className="text-sm text-base-content/70">No templates available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Mode</th>
                <th>Points</th>
                <th>Activity</th>
                <th>Claim Limit</th>
                <th>Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((template) => (
                <tr key={template.id}>
                  <td>{template.id}</td>
                  <td className="font-medium">{template.name}</td>
                  <td>
                    <span className="badge badge-outline badge-sm">
                      {template.points_mode === "manual" ? "manual" : "automatic"}
                    </span>
                  </td>
                  <td>
                    {template.points_mode === "manual" ? "Staff input" : template.points}
                  </td>
                  <td>{template.activity_id ?? "-"}</td>
                  <td>{template.claim_limit === 0 ? "Unlimited" : template.claim_limit}</td>
                  <td>
                    <button
                      className="btn btn-outline btn-xs"
                      title="Manage permissions"
                      onClick={() => openPermissions(template)}
                    >
                      Manage
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => openEdit(template)}>
                        <FiEdit2 />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        title="Delete"
                        onClick={() => handleDelete(template.id)}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTemplate(null);
        }}
        title={editingTemplate ? "Edit Template" : "Create Template"}
      >
        <TemplateForm
          initial={editingTemplate}
          activities={activities}
          onSubmit={editingTemplate ? handleUpdate : handleCreate}
          onCancel={() => {
            setModalOpen(false);
            setEditingTemplate(null);
          }}
        />
      </Modal>

      <Modal
        isOpen={permissionsModalOpen}
        onClose={() => {
          setPermissionsModalOpen(false);
          setPermissionsTemplate(null);
        }}
        title={permissionsTemplate ? `Template Permissions - ${permissionsTemplate.name}` : "Template Permissions"}
      >
        {permissionsLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-base-300 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold">Allowed Users</h4>
              <div className="flex items-center gap-2">
                <UserSelectField
                  users={users}
                  value={newUserSub}
                  onChange={(event) => setNewUserSub(event.target.value)}
                  placeholder="Select user"
                  allowEmpty
                />
                <button className="btn btn-primary btn-sm" onClick={addUserPermission}>
                  Add
                </button>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {permissions.user_subs.length === 0 ? (
                  <p className="text-sm text-base-content/70">No user-specific permissions.</p>
                ) : (
                  permissions.user_subs.map((userSub) => (
                    <div key={userSub} className="flex items-center justify-between gap-2 border border-base-300 rounded-lg p-2">
                      <span className="text-sm truncate">{userSub}</span>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => removeUserPermission(userSub)}>
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border border-base-300 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold">Allowed Roles</h4>
              <div className="flex items-center gap-2">
                <RoleSelectField
                  roles={roles}
                  value={newRoleName}
                  onChange={(event) => setNewRoleName(event.target.value)}
                  placeholder="Select role"
                  allowEmpty
                />
                <button className="btn btn-primary btn-sm" onClick={addRolePermission} disabled={!newRoleName.trim()}>
                  Add
                </button>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {permissions.role_names.length === 0 ? (
                  <p className="text-sm text-base-content/70">No role-specific permissions.</p>
                ) : (
                  permissions.role_names.map((roleName) => (
                    <div key={roleName} className="flex items-center justify-between gap-2 border border-base-300 rounded-lg p-2">
                      <span className="text-sm truncate">{roleName}</span>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => removeRolePermission(roleName)}>
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Panel>
  );
}

function HealthBadge({ status, onRefresh }) {
  const colorClass =
    status === "healthy" ? "badge-success" : status === "unreachable" ? "badge-error" : "badge-warning";

  return (
    <div className="flex items-center gap-2">
      <span className={`badge ${colorClass}`}>{status}</span>
      <button className="btn btn-ghost btn-xs" onClick={onRefresh}>
        <FiRefreshCw />
      </button>
    </div>
  );
}

export default function PointSystemAdminPage() {
  const api = useApi();
  const { showNotification } = useNotification();

  const [healthStatus, setHealthStatus] = useState("checking");
  const [syncing, setSyncing] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const [leaderboardEntries, setLeaderboardEntries] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const [activityFilter, setActivityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("");

  const userOptions = useMemo(() => {
    const mapped = new Map();

    users.forEach((user) => {
      if (!user?.id) {
        return;
      }
      const firstName = String(user.firstName || "").trim();
      const lastName = String(user.lastName || "").trim();
      const username = String(user.username || "").trim();
      const email = String(user.email || "").trim();
      const fullName = `${firstName} ${lastName}`.trim();
      let label = "";
      if (fullName && username) {
        label = `${fullName} (${username})`;
      } else if (fullName) {
        label = fullName;
      } else if (username) {
        label = username;
      } else if (email) {
        label = email;
      } else {
        label = String(user.id);
      }

      mapped.set(String(user.id), {
        id: String(user.id),
        label,
      });
    });

    transactions.forEach((transaction) => {
      if (!transaction?.user_id) {
        return;
      }
      const userId = String(transaction.user_id);
      if (!mapped.has(userId)) {
        mapped.set(userId, { id: userId, label: userId });
      }
    });

    leaderboardEntries.forEach((entry) => {
      if (!entry?.id) {
        return;
      }
      const userId = String(entry.id);
      if (!mapped.has(userId)) {
        mapped.set(userId, { id: userId, label: userId });
      }
    });

    return Array.from(mapped.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [users, transactions, leaderboardEntries]);

  const roleOptions = useMemo(() => {
    return (Array.isArray(roles) ? roles : [])
      .map((role) => {
        const roleName = String(role?.name || "").trim();
        if (!roleName) {
          return null;
        }
        return { name: roleName, label: roleName };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [roles]);

  const filteredLeaderboardEntries = useMemo(() => {
    if (!userFilter.trim()) {
      return leaderboardEntries;
    }
    return leaderboardEntries.filter((entry) => String(entry.id) === userFilter.trim());
  }, [leaderboardEntries, userFilter]);

  const totalPositiveTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.points > 0).length,
    [transactions]
  );

  const totalNegativeTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.points < 0).length,
    [transactions]
  );

  const fetchHealth = async () => {
    try {
      await api.get(`${POINT_SYSTEM_URL}/health`);
      setHealthStatus("healthy");
    } catch {
      setHealthStatus("unreachable");
    }
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const { data } = await api.get(TEMPLATES_URL);
      setTemplates(data);
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to load templates", "error");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const { data } = await api.get(ACTIVITIES_URL);
      setActivities(Array.isArray(data) ? data : []);
    } catch {
      setActivities([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.get(USERS_URL);
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data } = await api.get(ROLES_URL);
      setRoles(Array.isArray(data) ? data : []);
    } catch {
      setRoles([]);
    }
  };

  const fetchTransactions = async (nextActivityFilter, nextTypeFilter, nextUserFilter) => {
    setTransactionsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (nextActivityFilter) {
        params.set("activity_id", nextActivityFilter);
      }
      if (nextTypeFilter) {
        params.set("transaction_type", nextTypeFilter);
      }
      if (nextUserFilter) {
        params.set("user_id", nextUserFilter);
      }

      const { data } = await api.get(`${POINT_SYSTEM_URL}/transactions?${params.toString()}`);
      setTransactions(data);
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to load transaction log", "error");
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchLeaderboard = async (nextActivityFilter) => {
    setLeaderboardLoading(true);
    try {
      const endpoint = nextActivityFilter
        ? `${POINT_SYSTEM_URL}/leaderboard/${nextActivityFilter}`
        : `${POINT_SYSTEM_URL}/leaderboard`;
      const { data } = await api.get(endpoint);
      setLeaderboardEntries(data);
    } catch (error) {
      showNotification(error.response?.data?.detail || "Failed to load leaderboard", "error");
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const refreshAnalytics = async (
    nextActivityFilter = activityFilter,
    nextTypeFilter = transactionTypeFilter,
    nextUserFilter = userFilter
  ) => {
    setSyncing(true);
    await Promise.all([
      fetchTransactions(nextActivityFilter, nextTypeFilter, nextUserFilter),
      fetchLeaderboard(nextActivityFilter),
    ]);
    setSyncing(false);
  };

  const resetFilters = async () => {
    const alreadyClear = activityFilter === "" && transactionTypeFilter === "" && userFilter === "";
    setActivityFilter("");
    setTransactionTypeFilter("");
    setUserFilter("");
    if (alreadyClear) {
      await refreshAnalytics("", "", "");
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchTemplates();
    fetchActivities();
    fetchUsers();
    fetchRoles();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshAnalytics(activityFilter, transactionTypeFilter, userFilter);
    }, 250);

    return () => clearTimeout(timer);
  }, [activityFilter, transactionTypeFilter, userFilter]);

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1440px] mx-auto space-y-6">
        <header className="rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-base-content/60">Admin Console</p>
              <h1 className="text-3xl font-bold mt-1">Point System Operations</h1>
              <p className="text-sm text-base-content/70 mt-2">
                Professional interface for privileged transaction execution, oversight and template control.
              </p>
            </div>
            <HealthBadge status={healthStatus} onRefresh={fetchHealth} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="rounded-xl border border-base-300 p-3">
              <p className="text-xs text-base-content/60">Templates</p>
              <p className="text-xl font-semibold">{templates.length}</p>
            </div>
            <div className="rounded-xl border border-base-300 p-3">
              <p className="text-xs text-base-content/60">Transactions shown</p>
              <p className="text-xl font-semibold">{transactions.length}</p>
            </div>
            <div className="rounded-xl border border-base-300 p-3">
              <p className="text-xs text-base-content/60">Positive entries</p>
              <p className="text-xl font-semibold text-success">{totalPositiveTransactions}</p>
            </div>
            <div className="rounded-xl border border-base-300 p-3">
              <p className="text-xs text-base-content/60">Negative entries</p>
              <p className="text-xl font-semibold text-error">{totalNegativeTransactions}</p>
            </div>
          </div>
        </header>

        <PrivilegedActions
          api={api}
          showNotification={showNotification}
          templates={templates}
          activities={activities}
          users={userOptions}
          onActionComplete={refreshAnalytics}
        />

        <Panel
          title="Live Insights"
          subtitle="Shared filters are live and automatically apply to both transaction log and leaderboard."
          actions={
            <button className="btn btn-ghost btn-sm" onClick={resetFilters} disabled={syncing}>
              Reset
            </button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <UserSelectField
              users={userOptions}
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              placeholder="All users"
              allowEmpty
            />

            <ActivitySelectField
              activities={activities}
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value)}
              placeholder="Activity"
              allowEmpty
            />

            <select
              className="select select-bordered select-sm"
              value={transactionTypeFilter}
              onChange={(event) => setTransactionTypeFilter(event.target.value)}
            >
              <option value="">All transaction types</option>
              <option value="manual">Manual</option>
              <option value="activity">Activity</option>
              <option value="qrcode">QR Code</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TransactionLogsPanel
              transactions={transactions}
              loading={transactionsLoading}
              onRefresh={() => fetchTransactions(activityFilter, transactionTypeFilter, userFilter)}
            />

            <LeaderboardPanel
              entries={filteredLeaderboardEntries}
              loading={leaderboardLoading}
              onRefresh={() => fetchLeaderboard(activityFilter)}
            />
          </div>
        </Panel>

        <TemplatesSection
          api={api}
          showNotification={showNotification}
          templates={templates}
          setTemplates={setTemplates}
          activities={activities}
          users={userOptions}
          roles={roleOptions}
          loading={templatesLoading}
          refreshTemplates={fetchTemplates}
        />
      </div>
    </div>
  );
}
