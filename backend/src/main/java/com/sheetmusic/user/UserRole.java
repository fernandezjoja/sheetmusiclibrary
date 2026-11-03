package com.sheetmusic.user;

/**
 * User roles. They are not ranked: CORO can download PDFs and PRUEBA can't,
 * while PRUEBA sees unpublished scores and CORO doesn't. Each role's
 * capabilities are listed explicitly in
 * {@link com.sheetmusic.security.Permissions#from}.
 */
public enum UserRole {
    /** Local choir director: published scores, playback, recordings, PDF download. */
    CORO,
    /** Learns parts from test versions: published and unpublished scores, playback, recordings. No downloads. */
    PRUEBA,
    /** Music department member: everything except admin (unpublished, PDF, references, .mscz). */
    DEPARTAMENTO,
    /** Full access: browse, upload, edit, delete, manage users. */
    ADMIN
}
