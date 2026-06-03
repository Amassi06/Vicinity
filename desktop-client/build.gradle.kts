plugins {
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
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
    mainClass.set("com.vicinity.desktop.VicinityApp")
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
