import os
import glob

files = glob.glob('src/extension/**/*.js', recursive=True) + glob.glob('src/extension/**/*.css', recursive=True) + glob.glob('platforms/**/*.js', recursive=True)

old_header = """/**
 * @license GPLv3
 * Copyright (c) 2026 Mehmet Yasin Kaya. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * You shall not disclose, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of this software without prior written permission.
 */"""

new_header = """/**
 * @license Proprietary
 * Copyright (c) 2026 Mehmet Yasin Kaya. All Rights Reserved.
 *
 * This software and its documentation are the proprietary property of Mehmet Yasin Kaya.
 * You may not use, copy, modify, merge, publish, distribute, sublicense,
 * or sell copies of this software without prior written permission from the author.
 */"""

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    if old_header in content:
        content = content.replace(old_header, new_header)
        with open(f, 'w') as file:
            file.write(content)
        print(f"Updated {f}")

with open('LICENSE', 'w') as f:
    f.write("Copyright (c) 2026 Mehmet Yasin Kaya. All Rights Reserved.\n\nThis software and its documentation are the proprietary property of Mehmet Yasin Kaya.\nYou may not use, copy, modify, merge, publish, distribute, sublicense, or sell copies of this software without prior written permission from the author.\n")

