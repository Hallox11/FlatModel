'use strict';

/*
 * TV state, in one place.
 *
 * A TV has three states:
 *   OFFLINE  - not rezzed, or the server cannot reach it
 *   TV_OFF   - reachable, screen off
 *   TV_ON    - reachable, screen on
 *
 * They are derived from two independent facts, because different things set them:
 *   online : can the server reach the TV?   (ping, registration, kill, startup)
 *   power  : what the TV script last reported ('ON' | 'OFF')   (only /register)
 *
 * The derived value is stored in tv_registry.status (and mirrored in the in-memory registry,
 * including the roomId aliases), so everything that already reads `status` sees exactly
 * OFFLINE | TV_OFF | TV_ON. The `interactions` table stays the raw event history
 * (TV_ON / TV_OFF / rezz) and is also used once to backfill `power` for existing TVs.
 */

function deriveState(online, power) {
    if (!online) return 'OFFLINE';
    return power === 'ON' ? 'TV_ON' : 'TV_OFF';
}

// What a TV event means for the screen. `rezz` = just rezzed, not switched on yet.
// Unknown events return null, which means "leave power as it was".
function powerFromEvent(evt) {
    if (evt === 'TV_ON') return 'ON';
    if (evt === 'TV_OFF' || evt === 'rezz') return 'OFF';
    return null;
}

// Idempotent: safe to call on every start.
function ensureSchema(db) {
    const cols = db.prepare(`PRAGMA table_info(tv_registry)`).all().map(c => c.name);
    if (!cols.includes('online')) db.exec(`ALTER TABLE tv_registry ADD COLUMN online INTEGER NOT NULL DEFAULT 0`);
    if (!cols.includes('power'))  db.exec(`ALTER TABLE tv_registry ADD COLUMN power TEXT`);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_interactions_object ON interactions(object_id, timestamp)`);

    // Existing TVs: recover the screen state from the last event in the history.
    db.exec(`
        UPDATE tv_registry SET power = (
            SELECT CASE i.status WHEN 'TV_ON' THEN 'ON' ELSE 'OFF' END
            FROM interactions i
            WHERE i.object_id = tv_registry.object_id AND i.status IN ('TV_ON', 'TV_OFF', 'rezz')
            ORDER BY i.timestamp DESC, i.id DESC
            LIMIT 1
        )
        WHERE power IS NULL
    `);
}

function createTvState({ db, tvRegistry }) {
    ensureSchema(db);

    const stmtGet     = db.prepare(`SELECT online, power FROM tv_registry WHERE object_id = ?`);
    const stmtSet     = db.prepare(`UPDATE tv_registry SET online = ?, power = ?, status = ? WHERE object_id = ?`);
    const stmtSetSeen = db.prepare(`UPDATE tv_registry SET online = ?, power = ?, status = ?, last_seen = CURRENT_TIMESTAMP WHERE object_id = ?`);

    /*
     * setTvState(id, { online, power, touch })
     *   online : 1 / 0, leave undefined to keep the current value
     *   power  : 'ON' / 'OFF', leave undefined or null to keep the current value
     *   touch  : true also refreshes last_seen
     * Returns the new derived state.
     */
    function setTvState(id, { online, power, touch } = {}) {
        const row = stmtGet.get(id);

        const nextOnline = online === undefined ? (row ? row.online : 0) : (online ? 1 : 0);
        const nextPower  = power ? power : ((row && row.power) || 'OFF');
        const status     = deriveState(nextOnline, nextPower);

        if (row) (touch ? stmtSetSeen : stmtSet).run(nextOnline, nextPower, status, id);

        // In-memory registry: the TV itself and every roomId alias that points at it.
        for (const key of Object.keys(tvRegistry)) {
            const entry = tvRegistry[key];
            if (entry && (key === id || entry.object_id_ref === id)) {
                entry.online = !!nextOnline;
                entry.power  = nextPower;
                entry.status = status;
            }
        }
        return status;
    }

    return { setTvState, deriveState, powerFromEvent };
}

module.exports = { createTvState, deriveState, powerFromEvent, ensureSchema };