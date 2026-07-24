plugins {
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
    id("com.gradleup.shadow") version "8.3.5"
}

repositories {
    mavenCentral()
}

val jacksonVersion = "2.18.2"
val h2Version = "2.3.232"

dependencies {
    implementation("com.fasterxml.jackson.core:jackson-databind:$jacksonVersion")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:$jacksonVersion")
    implementation("com.h2database:h2:$h2Version")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

application {
    // Launcher (sans héritage d'Application) : évite le contrôle strict des
    // modules JavaFX par le lanceur Java pour le jar shadow.
    mainClass.set("com.vicinity.desktop.Launcher")
    applicationDefaultJvmArgs = listOf(
        "-Dvicinity.api.url=http://localhost:3000",
    )
}

javafx {
    version = "21.0.2"
    modules = listOf("javafx.controls")
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
}

tasks.named<JavaExec>("run") {
    standardInput = System.`in`
}

tasks.shadowJar {
    manifest {
        attributes["Main-Class"] = "com.vicinity.desktop.Launcher"
    }
    archiveClassifier.set("")
}

// Le shadow jar (classifier vide) remplace le jar standard : on désactive `jar`
// pour que les deux tâches n'écrivent pas le même fichier, et on déclare la
// dépendance des tâches de distribution vers `shadowJar` (exigé par Gradle 8).
tasks.jar { enabled = false }
tasks.named("distZip") { dependsOn(tasks.shadowJar) }
tasks.named("distTar") { dependsOn(tasks.shadowJar) }
tasks.named("startScripts") { dependsOn(tasks.shadowJar) }
