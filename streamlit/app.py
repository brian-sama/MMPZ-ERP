import streamlit as st
import pandas as pd
from sqlalchemy import create_engine
import os

st.set_page_config(page_title="MMPZ ERP Dashboard", layout="wide")

st.title("MMPZ ERP Dashboard")

# Get DATABASE_URL from environment
database_url = os.environ.get("DATABASE_URL")

@st.cache_resource
def get_engine():
    if not database_url:
        return None
    return create_engine(database_url)

engine = get_engine()

if not engine:
    st.error("DATABASE_URL environment variable is not set!")
else:
    try:
        with engine.connect() as conn:
            # Show existing tables as a health check
            df = pd.read_sql(
                "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';", 
                conn
            )
            
            st.success("Successfully connected to the database!")
            st.write("### Available Tables")
            st.dataframe(df)
            
    except Exception as e:
        st.error(f"Error connecting to the database: {e}")

st.sidebar.header("Navigation")
st.sidebar.info("Add more widgets or pages here later.")
