class Piml {
    constructor() {
        this.indentLevel = -1
    }

    stringify(obj) {
        return this.encodeValue(obj, -1, false)
    }

    encodeValue(value, indent, inArray) {
        if (value === null || value === undefined) {
            if (inArray) {
                return null // Should filter these out in encodeSlice if possible, or handle nicely
            }
            return " nil\n"
        }

        let indentStr = ""
        if (indent > 0) {
            indentStr = "  ".repeat(indent)
        }

        const type = typeof value
        if (type === "object") {
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    if (inArray) {
                        return `${indentStr}> nil\n` // Spec doesn't strictly define empty list item, but nil works
                    }
                    return " nil\n"
                }
                let result = ""
                if (!inArray) {
                    result += "\n"
                }
                result += this.encodeSlice(value, indent + 1)
                return result
            }

            if (value instanceof Date) {
                const s = value.toISOString()
                if (inArray) {
                    return `${indentStr}> ${s}\n`
                }
                return ` ${s}\n`
            }

            const keys = Object.keys(value)
            if (keys.length === 0) {
                 if (inArray) {
                    return `${indentStr}> nil\n`
                }
                return " nil\n"
            }

            if (inArray) {
                let itemName = "item"
                let result = `${indentStr}> (${itemName})\n`
                result += this.encodeStruct(value, indent)
                return result
            } else {
                let result = ""
                if (indent > -1) {
                    result += "\n"
                }
                result += this.encodeStruct(value, indent)
                return result
            }
        } else if (
            type === "string" ||
            type === "number" ||
            type === "boolean"
        ) {
            let s = String(value)
            if (type === "string") {
                if (s.includes('\n')) {
                    const lines = s.split('\n');
                    let result = '\n';
                    const multiLineIndentStr = "  ".repeat(indent + 1);
                    for (const line of lines) {
                        let lineToPush = line;
                        if (lineToPush.trim().startsWith('#')) {
                            lineToPush = `\\${lineToPush}`;
                        }
                        result += `${multiLineIndentStr}${lineToPush}\n`;
                    }
                    return result;
                }
                // Removed quoting logic to comply with Spec and Go implementation
            }
            
            if (inArray) {
                return `${indentStr}> ${s}\n`
            }
            return ` ${s}\n`
        } else {
            throw new Error(`Unsupported type: ${type}`)
        }
    }

    encodeStruct(obj, indent) {
        let result = ""
        const fieldIndent = indent + 1
        let indentStr = ""
        if (fieldIndent > 0) {
            indentStr = "  ".repeat(fieldIndent)
        }

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key]
                result += `${indentStr}(${key})`
                result += this.encodeValue(value, fieldIndent, false)
            }
        }
        return result
    }

    encodeSlice(arr, indent) {
        if (arr.length === 0) {
            return ""
        }

        let result = ""
        for (const item of arr) {
            // Check for null/undefined items and handle them as 'nil' explicitly if needed
            // encodeValue handles them.
            const encoded = this.encodeValue(item, indent, true);
            if (encoded !== null) {
                 result += encoded;
            } else {
                // If encodeValue returned null (shouldn't happen for inArray=true with current logic except undefined)
                let indentStr = "  ".repeat(indent)
                result += `${indentStr}> nil\n`
            }
        }
        return result
    }

    parse(pimlString) {
        const lines = pimlString.split('\n');
        const root = {};
        const stack = [{ indent: -1, obj: root }];

        let i = 0;
        while (i < lines.length) {
            let line = lines[i];
            // Skip comment lines
            if (line.trim().startsWith('#')) {
                i++;
                continue;
            }
            
            // Check for escaped hash at start of line (unlikely in root, but possible in values)
            // But here we are parsing structure.
            
            const trimmedLine = line.trim();

            if (trimmedLine === '') {
                i++;
                continue;
            }

            const indent = line.length - line.trimStart().length;

            while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
                stack.pop();
            }

            const parent = stack[stack.length - 1].obj;

            if (trimmedLine.startsWith('>')) {
                const valueStr = trimmedLine.substring(1).trim();
                
                // Logic to distinguish object item vs string item
                // > (item)
                //   (key) val
                
                // Check if the current line looks like an object start > (key)
                let looksLikeObjectStart = false;
                if (valueStr.startsWith('(') && valueStr.endsWith(')')) {
                     // It is just > (key), no value on this line.
                     // It *could* be a string "(key)", OR the start of an object.
                     // We check if the next line is indented relative to THIS line.
                     // The indent of this line is `indent`.
                     // The children should be `> indent`.
                     
                     let j = i + 1;
                     while (j < lines.length) {
                         const nextLine = lines[j];
                         if (nextLine.trim() === '' || nextLine.trim().startsWith('#')) {
                             j++;
                             continue;
                         }
                         const nextIndent = nextLine.length - nextLine.trimStart().length;
                         if (nextIndent > indent) {
                             looksLikeObjectStart = true;
                         }
                         break;
                     }
                }
                
                // Also check > (item) ... with no indentation check if strictly following spec convention?
                // Spec: "The (item_key) is considered metadata... A parser must ignore this key and simply interpret the indented block as an object"
                
                if (looksLikeObjectStart) {
                     const newObj = {};
                     if (!Array.isArray(parent)) {
                        // Error or ignore?
                        i++; continue; 
                    }
                    parent.push(newObj);
                    stack.push({ indent: indent, obj: newObj });
                    i++;
                } else {
                     if (!Array.isArray(parent)) {
                        i++; continue;
                    }
                    // It's a primitive value (string, number, nil, etc.)
                    parent.push(this.parseValue(valueStr));
                    i++;
                }

            } else if (trimmedLine.startsWith('(')) {
                const keyMatch = trimmedLine.match(/^\((.*?)\)(.*)/);
                if (!keyMatch) {
                    i++;
                    continue;
                }
                const key = keyMatch[1];
                const valueStr = keyMatch[2].trim();

                if (valueStr === '') {
                    // Check if it's a nested object/array or multiline string or empty string
                    let j = i + 1;
                    let nextLine = '';
                    let nextIndent = 0;
                    
                    let lookaheadIndex = j;
                    while(lookaheadIndex < lines.length) {
                         const l = lines[lookaheadIndex];
                         if (l.trim() !== '' && !l.trim().startsWith('#')) {
                             nextLine = l;
                             nextIndent = l.length - l.trimStart().length;
                             break;
                         }
                         lookaheadIndex++;
                    }
                    
                    if (lookaheadIndex === lines.length || nextIndent <= indent) {
                         // No indented children -> Empty string (or null? Spec says nil for null. Empty string is "")
                         // But wait, if I have `(key)` and nothing else, it's effectively empty string.
                         parent[key] = '';
                         i++;
                         continue;
                    }

                    if (nextIndent > indent) {
                        if (nextLine.trim().startsWith('>')) {
                            // Array
                            const newArr = [];
                            parent[key] = newArr;
                            stack.push({ indent: indent, obj: newArr });
                            i++; 
                        } else if (nextLine.trim().startsWith('(')) {
                            // Object
                            const newObj = {};
                            parent[key] = newObj;
                            stack.push({ indent: indent, obj: newObj });
                            i++;
                        } else {
                            // Multiline string
                            const multiLineParts = [];
                            j = i + 1;
                            while (j < lines.length) {
                                let currentLine = lines[j];
                                // Handle blank lines in multiline string
                                if (currentLine.trim() === '') {
                                     // Check if we passed the block
                                     // Peek next non-blank line
                                     // This is expensive/complex. 
                                     // Simple heuristic: If it's blank, include it as newline. 
                                     // We trim trailing blank lines later if needed.
                                     multiLineParts.push(''); // Add empty line
                                     j++;
                                     continue;
                                }
                                
                                const currentIndent = currentLine.length - currentLine.trimStart().length;
                                if (currentIndent <= indent) break;

                                let lineToPush = currentLine.substring(indent + 2); // Assume 2-space offset from parent key
                                // Safe guard if indent is different
                                if (lineToPush === undefined) lineToPush = currentLine.trim();

                                if (lineToPush.trim().startsWith('\\#')) {
                                    // Handle escaping of # at start of line
                                     const trimIdx = lineToPush.indexOf('\\#');
                                     if (trimIdx !== -1 && lineToPush.substring(0, trimIdx).trim() === '') {
                                         // only replace if it's the start of content
                                         lineToPush = lineToPush.replace('\\#', '#');
                                     }
                                }
                                multiLineParts.push(lineToPush);
                                j++;
                            }
                            // Join
                            // Trim trailing empty lines from multiLineParts
                            while (multiLineParts.length > 0 && multiLineParts[multiLineParts.length - 1] === '') {
                                multiLineParts.pop();
                            }
                            let result = multiLineParts.join('\n');
                            // Trim trailing newlines from the string itself? Spec says "preserved". 
                            // But usually trailing newline of the block is implicit.
                            parent[key] = result;
                            i = j;
                        }
                    } 
                } else {
                    parent[key] = this.parseValue(valueStr);
                    i++;
                }
            } else {
                // Unknown line type
                i++;
            }
        }

        return root;
    }

    parseValue(valueStr) {
        if (valueStr === 'nil') {
            return null;
        }
        // Support legacy/robustness
        if (valueStr === '{}') return {}; // Spec violation but useful for reading old files? Or maybe just return null? Let's keep for now.
        if (valueStr === '[]') return [];

        if (!isNaN(valueStr) && valueStr.trim() !== '') {
            return Number(valueStr);
        }
        if (valueStr === 'true') return true;
        if (valueStr === 'false') return false;
        
        // Date parsing
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
        if (isoDateRegex.test(valueStr)) {
            const date = new Date(valueStr);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        return valueStr;
    }
}

const piml = new Piml()

module.exports = {
    Piml,
    stringify: piml.stringify.bind(piml),
    parse: piml.parse.bind(piml),
}
