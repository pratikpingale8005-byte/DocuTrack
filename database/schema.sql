--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6 (Homebrew)
-- Dumped by pg_dump version 18.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: detect_bulk_downloads(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_bulk_downloads() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    alert_count INTEGER := 0;
BEGIN

    INSERT INTO Anomaly_Alerts
        (user_id, alert_type, details)
    SELECT
        al.user_id,
        'BULK_DOWNLOAD',
        'User performed more than 10 downloads within 5 minutes'
    FROM Activity_Log al
    WHERE al.action = 'DOWNLOAD'
    GROUP BY al.user_id
    HAVING COUNT(*) FILTER (
        WHERE al.action_timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    ) > 10
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS alert_count = ROW_COUNT;

    RETURN alert_count;
END;
$$;


--
-- Name: detect_excessive_downloads(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_excessive_downloads() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    alert_count INTEGER := 0;
BEGIN

    INSERT INTO Anomaly_Alerts
        (user_id, alert_type, details)
    SELECT
        al.user_id,
        'EXCESSIVE_DOWNLOAD',
        'Same file was downloaded 20 or more times within 1 day'
    FROM Activity_Log al
    WHERE al.action = 'DOWNLOAD'
      AND al.action_timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 day'
    GROUP BY al.user_id, al.file_id
    HAVING COUNT(*) >= 20;

    GET DIAGNOSTICS alert_count = ROW_COUNT;

    RETURN alert_count;
END;
$$;


--
-- Name: detect_mass_deletes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_mass_deletes() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    alert_count INTEGER := 0;
BEGIN

    INSERT INTO Anomaly_Alerts
        (user_id, alert_type, details)
    SELECT
        al.user_id,
        'MASS_DELETE',
        'User performed more than 3 file deletions within 1 hour'
    FROM Activity_Log al
    WHERE al.action = 'DELETE'
      AND al.action_timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
    GROUP BY al.user_id
    HAVING COUNT(*) > 3;

    GET DIAGNOSTICS alert_count = ROW_COUNT;

    RETURN alert_count;
END;
$$;


--
-- Name: fn_version_changelog(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_version_changelog() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    previous_size BIGINT;
BEGIN
    SELECT file_size
    INTO previous_size
    FROM File_Versions
    WHERE file_id = NEW.file_id
      AND version_number = NEW.version_number - 1;

    INSERT INTO Version_Changelog (
        version_id,
        change_summary,
        size_delta
    )
    VALUES (
        NEW.version_id,
        'New version uploaded',
        NEW.file_size - COALESCE(previous_size, 0)
    );

    RETURN NEW;
END;
$$;


--
-- Name: run_anomaly_detection(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_anomaly_detection() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

    -- Check download-related suspicious activity
    IF NEW.action = 'DOWNLOAD' THEN
        PERFORM detect_bulk_downloads();
        PERFORM detect_excessive_downloads();
    END IF;

    -- Check delete-related suspicious activity
    IF NEW.action = 'DELETE' THEN
        PERFORM detect_mass_deletes();
    END IF;

    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    activity_id integer NOT NULL,
    file_id integer,
    user_id integer,
    action character varying(100) NOT NULL,
    action_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    details character varying(500)
);


--
-- Name: activity_log_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_log_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_log_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_log_activity_id_seq OWNED BY public.activity_log.activity_id;


--
-- Name: anomaly_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anomaly_alerts (
    alert_id integer NOT NULL,
    user_id integer NOT NULL,
    alert_type character varying(100) NOT NULL,
    detected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    details character varying(500),
    is_resolved boolean DEFAULT false
);


--
-- Name: anomaly_alerts_alert_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.anomaly_alerts_alert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: anomaly_alerts_alert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.anomaly_alerts_alert_id_seq OWNED BY public.anomaly_alerts.alert_id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    category_id integer NOT NULL,
    category_name character varying(50) NOT NULL,
    description character varying(255)
);


--
-- Name: categories_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_category_id_seq OWNED BY public.categories.category_id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    department_id integer NOT NULL,
    department_name character varying(100) NOT NULL,
    storage_quota_bytes bigint DEFAULT '5368709120'::bigint
);


--
-- Name: departments_department_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departments_department_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departments_department_id_seq OWNED BY public.departments.department_id;


--
-- Name: file_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_tags (
    file_id integer NOT NULL,
    tag_id integer NOT NULL
);


--
-- Name: file_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_versions (
    version_id integer NOT NULL,
    file_id integer NOT NULL,
    version_number integer NOT NULL,
    storage_path character varying(500) NOT NULL,
    file_size bigint NOT NULL,
    file_hash character(64),
    modified_by integer NOT NULL,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: file_versions_version_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.file_versions_version_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: file_versions_version_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.file_versions_version_id_seq OWNED BY public.file_versions.version_id;


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    file_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_extension character varying(10) NOT NULL,
    category_id integer NOT NULL,
    uploaded_by integer NOT NULL,
    current_version_id integer,
    policy_id integer,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: files_file_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.files_file_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: files_file_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.files_file_id_seq OWNED BY public.files.file_id;


--
-- Name: ownership_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ownership_transfers (
    transfer_id integer NOT NULL,
    file_id integer NOT NULL,
    from_user_id integer NOT NULL,
    to_user_id integer NOT NULL,
    transferred_by integer NOT NULL,
    transferred_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reason character varying(500)
);


--
-- Name: ownership_transfers_transfer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ownership_transfers_transfer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ownership_transfers_transfer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ownership_transfers_transfer_id_seq OWNED BY public.ownership_transfers.transfer_id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    permission_id integer NOT NULL,
    permission_name character varying(50) NOT NULL
);


--
-- Name: permissions_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_permission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_permission_id_seq OWNED BY public.permissions.permission_id;


--
-- Name: retention_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retention_policies (
    policy_id integer NOT NULL,
    policy_name character varying(100) NOT NULL,
    retention_days integer NOT NULL,
    applies_to_category_id integer,
    action_on_expiry character varying(20) DEFAULT 'flag'::character varying,
    CONSTRAINT retention_policies_action_on_expiry_check CHECK (((action_on_expiry)::text = ANY ((ARRAY['flag'::character varying, 'soft_delete'::character varying, 'notify'::character varying])::text[])))
);


--
-- Name: retention_policies_policy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.retention_policies_policy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: retention_policies_policy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.retention_policies_policy_id_seq OWNED BY public.retention_policies.policy_id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    role_id integer NOT NULL,
    role_name character varying(50) NOT NULL
);


--
-- Name: roles_role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_role_id_seq OWNED BY public.roles.role_id;


--
-- Name: shared_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_access (
    share_id integer NOT NULL,
    file_id integer NOT NULL,
    shared_with integer NOT NULL,
    shared_by integer NOT NULL,
    permission_type character varying(20) DEFAULT 'view'::character varying,
    shared_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT shared_access_permission_type_check CHECK (((permission_type)::text = ANY ((ARRAY['view'::character varying, 'edit'::character varying, 'download'::character varying])::text[])))
);


--
-- Name: shared_access_share_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shared_access_share_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shared_access_share_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shared_access_share_id_seq OWNED BY public.shared_access.share_id;


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    tag_id integer NOT NULL,
    tag_name character varying(50) NOT NULL
);


--
-- Name: tags_tag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tags_tag_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tags_tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tags_tag_id_seq OWNED BY public.tags.tag_id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role_id integer NOT NULL,
    department_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: version_changelog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.version_changelog (
    changelog_id integer NOT NULL,
    version_id integer NOT NULL,
    change_summary character varying(500),
    size_delta bigint
);


--
-- Name: version_changelog_changelog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.version_changelog_changelog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: version_changelog_changelog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.version_changelog_changelog_id_seq OWNED BY public.version_changelog.changelog_id;


--
-- Name: vw_department_storage_usage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_department_storage_usage AS
 SELECT d.department_id,
    d.department_name,
    d.storage_quota_bytes,
    COALESCE(sum(fv.file_size), (0)::numeric) AS used_storage_bytes,
    ((d.storage_quota_bytes)::numeric - COALESCE(sum(fv.file_size), (0)::numeric)) AS remaining_storage_bytes
   FROM (((public.departments d
     LEFT JOIN public.users u ON ((d.department_id = u.department_id)))
     LEFT JOIN public.files f ON (((u.user_id = f.uploaded_by) AND (f.is_deleted = false))))
     LEFT JOIN public.file_versions fv ON ((f.current_version_id = fv.version_id)))
  GROUP BY d.department_id, d.department_name, d.storage_quota_bytes;


--
-- Name: vw_file_version_history; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_file_version_history AS
 SELECT f.file_id,
    f.file_name,
    fv.version_id,
    fv.version_number,
    fv.storage_path,
    fv.file_size,
    fv.file_hash,
    u.name AS modified_by,
    fv.modified_at
   FROM ((public.files f
     JOIN public.file_versions fv ON ((f.file_id = fv.file_id)))
     JOIN public.users u ON ((fv.modified_by = u.user_id)));


--
-- Name: activity_log activity_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log ALTER COLUMN activity_id SET DEFAULT nextval('public.activity_log_activity_id_seq'::regclass);


--
-- Name: anomaly_alerts alert_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_alerts ALTER COLUMN alert_id SET DEFAULT nextval('public.anomaly_alerts_alert_id_seq'::regclass);


--
-- Name: categories category_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN category_id SET DEFAULT nextval('public.categories_category_id_seq'::regclass);


--
-- Name: departments department_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments ALTER COLUMN department_id SET DEFAULT nextval('public.departments_department_id_seq'::regclass);


--
-- Name: file_versions version_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_versions ALTER COLUMN version_id SET DEFAULT nextval('public.file_versions_version_id_seq'::regclass);


--
-- Name: files file_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files ALTER COLUMN file_id SET DEFAULT nextval('public.files_file_id_seq'::regclass);


--
-- Name: ownership_transfers transfer_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_transfers ALTER COLUMN transfer_id SET DEFAULT nextval('public.ownership_transfers_transfer_id_seq'::regclass);


--
-- Name: permissions permission_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN permission_id SET DEFAULT nextval('public.permissions_permission_id_seq'::regclass);


--
-- Name: retention_policies policy_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_policies ALTER COLUMN policy_id SET DEFAULT nextval('public.retention_policies_policy_id_seq'::regclass);


--
-- Name: roles role_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN role_id SET DEFAULT nextval('public.roles_role_id_seq'::regclass);


--
-- Name: shared_access share_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_access ALTER COLUMN share_id SET DEFAULT nextval('public.shared_access_share_id_seq'::regclass);


--
-- Name: tags tag_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags ALTER COLUMN tag_id SET DEFAULT nextval('public.tags_tag_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Name: version_changelog changelog_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_changelog ALTER COLUMN changelog_id SET DEFAULT nextval('public.version_changelog_changelog_id_seq'::regclass);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (activity_id);


--
-- Name: anomaly_alerts anomaly_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_alerts
    ADD CONSTRAINT anomaly_alerts_pkey PRIMARY KEY (alert_id);


--
-- Name: categories categories_category_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_category_name_key UNIQUE (category_name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (category_id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (department_id);


--
-- Name: file_tags file_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_tags
    ADD CONSTRAINT file_tags_pkey PRIMARY KEY (file_id, tag_id);


--
-- Name: file_versions file_versions_file_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_versions
    ADD CONSTRAINT file_versions_file_id_version_number_key UNIQUE (file_id, version_number);


--
-- Name: file_versions file_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_versions
    ADD CONSTRAINT file_versions_pkey PRIMARY KEY (version_id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (file_id);


--
-- Name: ownership_transfers ownership_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_pkey PRIMARY KEY (transfer_id);


--
-- Name: permissions permissions_permission_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_permission_name_key UNIQUE (permission_name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (permission_id);


--
-- Name: retention_policies retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_pkey PRIMARY KEY (policy_id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- Name: roles roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_name_key UNIQUE (role_name);


--
-- Name: shared_access shared_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_access
    ADD CONSTRAINT shared_access_pkey PRIMARY KEY (share_id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (tag_id);


--
-- Name: tags tags_tag_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_tag_name_key UNIQUE (tag_name);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: version_changelog version_changelog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_changelog
    ADD CONSTRAINT version_changelog_pkey PRIMARY KEY (changelog_id);


--
-- Name: activity_log trg_anomaly_detection; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_anomaly_detection AFTER INSERT ON public.activity_log FOR EACH ROW WHEN (((new.action)::text = ANY ((ARRAY['DOWNLOAD'::character varying, 'DELETE'::character varying])::text[]))) EXECUTE FUNCTION public.run_anomaly_detection();


--
-- Name: file_versions trg_version_changelog; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_version_changelog AFTER INSERT ON public.file_versions FOR EACH ROW EXECUTE FUNCTION public.fn_version_changelog();


--
-- Name: activity_log activity_log_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(file_id);


--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: anomaly_alerts anomaly_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_alerts
    ADD CONSTRAINT anomaly_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: file_tags file_tags_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_tags
    ADD CONSTRAINT file_tags_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(file_id);


--
-- Name: file_tags file_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_tags
    ADD CONSTRAINT file_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(tag_id);


--
-- Name: file_versions file_versions_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_versions
    ADD CONSTRAINT file_versions_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(file_id);


--
-- Name: file_versions file_versions_modified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_versions
    ADD CONSTRAINT file_versions_modified_by_fkey FOREIGN KEY (modified_by) REFERENCES public.users(user_id);


--
-- Name: files files_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id);


--
-- Name: files files_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.retention_policies(policy_id);


--
-- Name: files files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(user_id);


--
-- Name: files fk_current_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT fk_current_version FOREIGN KEY (current_version_id) REFERENCES public.file_versions(version_id);


--
-- Name: ownership_transfers ownership_transfers_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(file_id);


--
-- Name: ownership_transfers ownership_transfers_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(user_id);


--
-- Name: ownership_transfers ownership_transfers_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(user_id);


--
-- Name: ownership_transfers ownership_transfers_transferred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_transferred_by_fkey FOREIGN KEY (transferred_by) REFERENCES public.users(user_id);


--
-- Name: retention_policies retention_policies_applies_to_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_applies_to_category_id_fkey FOREIGN KEY (applies_to_category_id) REFERENCES public.categories(category_id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(permission_id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id);


--
-- Name: shared_access shared_access_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_access
    ADD CONSTRAINT shared_access_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(file_id);


--
-- Name: shared_access shared_access_shared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_access
    ADD CONSTRAINT shared_access_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES public.users(user_id);


--
-- Name: shared_access shared_access_shared_with_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_access
    ADD CONSTRAINT shared_access_shared_with_fkey FOREIGN KEY (shared_with) REFERENCES public.users(user_id);


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(department_id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id);


--
-- Name: version_changelog version_changelog_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_changelog
    ADD CONSTRAINT version_changelog_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.file_versions(version_id);


--
-- PostgreSQL database dump complete
--


