buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.11.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }

    // Kotlin 1.9's incremental cache cannot relativize Cargo sources on a
    // different Windows drive. Fully compile only those external modules.
    if (projectDir.toPath().root != rootProject.projectDir.toPath().root) {
        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
            incremental = false
        }
    }
}

tasks.register("clean").configure {
    delete("build")
}
