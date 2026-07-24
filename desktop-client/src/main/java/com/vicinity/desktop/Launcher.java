package com.vicinity.desktop;

/**
 * Point d'entrée du jar exécutable. Ne doit PAS hériter de
 * javafx.application.Application : le lanceur Java sinon exige les modules
 * JavaFX sur le module-path (--module-path/--add-modules), ce qui échoue
 * pour un jar shadow où JavaFX est sur le classpath.
 */
public final class Launcher {

    private Launcher() {
    }

    public static void main(final String[] args) {
        VicinityApp.main(args);
    }
}
