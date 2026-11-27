package com.asisvpn.client.vpn;

/** Failure with a stable code that reaches the web UI (e.g. ENGINE_START_FAILED). */
public class EngineException extends Exception {
    public final String code;

    public EngineException(String code, String message) {
        super(message);
        this.code = code;
    }
}
