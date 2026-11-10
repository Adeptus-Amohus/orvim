"""Collect public Maven license metadata and embedded notices, read-only.

Usage: python scripts/collect-android-notices.py <Gradle modules-2/files-2.1>
Includes AndroidX/Kotlin/Material/desugaring and their common runtime dependency
families, not Gradle plugins or private credentials. The cache may contain extra
versions; compare releaseRuntimeClasspath before distribution. Original notice
text is preserved.
"""
import io
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(sys.argv[1]).resolve()
groups = ('androidx.', 'org.jetbrains.kotlin', 'org.jetbrains:annotations',
          'com.google.android.material', 'com.android.tools:desugar_jdk_libs',
          'com.google.guava', 'com.google.errorprone', 'com.google.code.findbugs',
          'com.google.j2objc', 'com.google.protobuf', 'org.jspecify',
          'org.checkerframework', 'javax.inject', 'javax.annotation')
sections = []
seen = set()

def notices(archive, label):
    with zipfile.ZipFile(archive) as z:
        for item in z.namelist():
            name = Path(item).name.upper()
            if name.startswith(('LICENSE', 'NOTICE', 'COPYING')) and not item.endswith('/'):
                data = z.read(item)
                if len(data) < 500000 and data not in seen:
                    seen.add(data)
                    sections.append(f'\n{label}: {item}\n' + data.decode('utf-8', errors='replace'))
            if item == 'classes.jar':
                notices(io.BytesIO(z.read(item)), label + '/classes.jar')

for group in sorted(root.iterdir()):
    for artifact in sorted(group.iterdir()):
        coordinate = group.name + ':' + artifact.name
        if not any(coordinate.startswith(prefix) for prefix in groups):
            continue
        for version in sorted(artifact.iterdir()):
            sections.append('\n' + '='*72 + '\n' + coordinate + ':' + version.name + '\n')
            for file in sorted(version.rglob('*')):
                if file.suffix == '.pom':
                    tree = ET.parse(file)
                    for tag in ('licenses', 'developers', 'scm'):
                        element = tree.find('{*}' + tag)
                        if element is not None:
                            sections.append(ET.tostring(element, encoding='unicode'))
                elif file.suffix in ('.aar', '.jar'):
                    notices(file, coordinate + ':' + version.name)

destination = Path('third-party/android-notices.txt')
destination.parent.mkdir(exist_ok=True)
destination.write_text('Android library notices. Maven metadata and original embedded notices; these components keep their upstream licenses.\n' + '\n'.join(sections), encoding='utf-8', newline='\n')
print(f'Android notices: {len(sections)} metadata/notice sections collected.')
