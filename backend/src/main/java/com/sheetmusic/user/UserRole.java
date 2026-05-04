package com.sheetmusic.user;

/**
 * User roles, ordered by capability via the {@link #rank} field. Comparisons
 * use {@link #atLeast(UserRole)} rather than {@link Enum#ordinal()} — explicit
 * ranks (with gaps) let intermediate roles slot in later without renumbering
 * existing rows.
 */
public enum UserRole {
    /** Browse all scores including unpublished test versions; no references, no .mscz, no admin. */
    USER(10),
    /** USER + see references (with their notes) and download .mscz archives. */
    COLLABORATOR(20),
    /** Full access: browse, upload, edit, delete, manage users. */
    ADMIN(30);

    private final int rank;

    UserRole(int rank) {
        this.rank = rank;
    }

    public int rank() {
        return rank;
    }

    public boolean atLeast(UserRole other) {
        return this.rank >= other.rank;
    }
}
