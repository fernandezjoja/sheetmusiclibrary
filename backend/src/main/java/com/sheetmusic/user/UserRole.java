package com.sheetmusic.user;

public enum UserRole {
    /** Can browse all scores, including unpublished test versions, but cannot upload or edit. */
    USER,
    /** Full access: browse, upload, edit, manage users. */
    ADMIN
}
