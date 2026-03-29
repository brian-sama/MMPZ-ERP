import os
import pandas as pd
import streamlit as st
from sqlalchemy import create_engine, text

st.set_page_config(page_title="MMPZ ERP Analytics", layout="wide")

DATABASE_URL = os.environ.get("DATABASE_URL")


@st.cache_resource
def get_engine():
    if not DATABASE_URL:
        return None
    return create_engine(DATABASE_URL)


def read_sql_df(query, params=None):
    engine = get_engine()
    if engine is None:
        return pd.DataFrame()

    with engine.connect() as conn:
        return pd.read_sql(text(query), conn, params=params or {})


engine = get_engine()

st.title("Advanced Analytics")
st.caption("Operational visibility across programs, approvals, finance, procurement, and delivery performance.")

if not engine:
    st.error("DATABASE_URL environment variable is not set.")
    st.stop()

summary_df = read_sql_df(
    """
    SELECT
        (SELECT COUNT(*) FROM programs WHERE status = 'active') AS active_programs,
        (SELECT COUNT(*) FROM projects WHERE status = 'active') AS active_projects,
        (SELECT COUNT(*) FROM users WHERE role_code = 'DEVELOPMENT_FACILITATOR') AS facilitators,
        (SELECT COUNT(*) FROM approvals WHERE status = 'pending') AS pending_approvals,
        (SELECT COALESCE(SUM(total_budget), 0) FROM indicators WHERE status = 'active') AS total_budget,
        (SELECT COALESCE(SUM(current_budget_balance), 0) FROM indicators WHERE status = 'active') AS budget_balance
    """
)

if summary_df.empty:
    st.warning("No analytics data is available yet.")
    st.stop()

summary = summary_df.iloc[0]
total_budget = float(summary.get("total_budget") or 0)
budget_balance = float(summary.get("budget_balance") or 0)
budget_used = max(total_budget - budget_balance, 0)
budget_utilization = round((budget_used / total_budget) * 100, 1) if total_budget else 0

col1, col2, col3, col4 = st.columns(4)
col1.metric("Active Programs", int(summary.get("active_programs") or 0))
col2.metric("Active Projects", int(summary.get("active_projects") or 0))
col3.metric("Pending Approvals", int(summary.get("pending_approvals") or 0))
col4.metric("Budget Used", f"{budget_utilization}%")

col5, col6 = st.columns(2)
with col5:
    st.subheader("Workforce Distribution")
    users_df = read_sql_df(
        """
        SELECT
            COALESCE(system_role, 'UNASSIGNED') AS system_role,
            COUNT(*) AS total
        FROM users
        GROUP BY COALESCE(system_role, 'UNASSIGNED')
        ORDER BY total DESC
        """
    )
    if not users_df.empty:
        st.bar_chart(users_df.set_index("system_role"))
    else:
        st.info("No user data available.")

with col6:
    st.subheader("Procurement by Status")
    procurement_df = read_sql_df(
        """
        SELECT
            status,
            COUNT(*) AS total_requests,
            COALESCE(SUM(total_estimated_cost), 0) AS total_value
        FROM procurement_requests
        GROUP BY status
        ORDER BY total_value DESC
        """
    )
    if not procurement_df.empty:
        chart_df = procurement_df[["status", "total_value"]].set_index("status")
        st.bar_chart(chart_df)
    else:
        st.info("No procurement requests recorded.")

trend_col, progress_col = st.columns(2)
with trend_col:
    st.subheader("Approval Queue Trend")
    approvals_df = read_sql_df(
        """
        SELECT
            DATE_TRUNC('day', created_at)::date AS day,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'approved') AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
        FROM approvals
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1 ASC
        """
    )
    if not approvals_df.empty:
        chart_df = approvals_df.set_index("day")
        st.line_chart(chart_df)
    else:
        st.info("No approval trend data for the last 30 days.")

with progress_col:
    st.subheader("Indicator Performance")
    indicators_df = read_sql_df(
        """
        SELECT
            title,
            target_value,
            current_value,
            CASE
                WHEN target_value > 0 THEN ROUND((current_value::numeric / target_value::numeric) * 100, 1)
                ELSE 0
            END AS progress_pct,
            priority
        FROM indicators
        WHERE status <> 'archived'
        ORDER BY progress_pct ASC, priority DESC
        LIMIT 10
        """
    )
    if not indicators_df.empty:
        st.dataframe(
            indicators_df,
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("No indicator data available.")

delivery_col, finance_col = st.columns(2)
with delivery_col:
    st.subheader("Projects by Status")
    project_status_df = read_sql_df(
        """
        SELECT
            status,
            COUNT(*) AS total
        FROM projects
        GROUP BY status
        ORDER BY total DESC
        """
    )
    if not project_status_df.empty:
        st.bar_chart(project_status_df.set_index("status"))
    else:
        st.info("No project status data available.")

with finance_col:
    st.subheader("Budget Snapshot")
    finance_snapshot_df = pd.DataFrame(
        {
            "metric": ["Allocated", "Used", "Remaining"],
            "value": [total_budget, budget_used, budget_balance],
        }
    )
    st.bar_chart(finance_snapshot_df.set_index("metric"))

st.subheader("Recent Operational Activity")
activity_df = read_sql_df(
    """
    SELECT created_at, activity_type, summary
    FROM (
        SELECT
            created_at,
            'Procurement' AS activity_type,
            title AS summary
        FROM procurement_requests
        UNION ALL
        SELECT
            created_at,
            'Approval' AS activity_type,
            entity_type || ' · ' || status AS summary
        FROM approvals
        UNION ALL
        SELECT
            created_at,
            'Announcement' AS activity_type,
            title AS summary
        FROM announcements
    ) combined
    ORDER BY created_at DESC
    LIMIT 15
    """
)

if not activity_df.empty:
    st.dataframe(activity_df, use_container_width=True, hide_index=True)
else:
    st.info("No recent activity available.")

st.subheader("Downloadable Slices")
download_df = read_sql_df(
    """
    SELECT
        pr.title,
        pr.status,
        pr.total_estimated_cost,
        COALESCE(p.name, 'Unassigned') AS project_name,
        pr.created_at
    FROM procurement_requests pr
    LEFT JOIN projects p ON pr.project_id = p.id
    ORDER BY pr.created_at DESC
    LIMIT 50
    """
)

if not download_df.empty:
    csv_data = download_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        "Download Procurement Snapshot",
        data=csv_data,
        file_name="mmpz-procurement-snapshot.csv",
        mime="text/csv",
    )
    st.dataframe(download_df, use_container_width=True, hide_index=True)
else:
    st.info("No procurement data available to export.")
