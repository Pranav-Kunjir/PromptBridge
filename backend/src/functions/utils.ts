
export const formatResponseCode = (text: string): string => {
    // Some frontends or specific APIs (like compiling to python engines) 
    // want the literal \n sequence explicitly preserved as text rather than an actual invisible newline character.
    // If we receive "Line 1\nLine 2", we convert it to "Line 1\\nLine 2".

    // Convert physical newlines to the string characters "\" and "n"
    let formatted = text
        .replace(/\\n/g, "\n")
        .replace(/^Python\s*/, ""); // remove leading "Python" label if present

    // Convert carriage returns too in case Windows encoding crept in
    formatted = formatted.replace(/\r/g, '\\r');

    return formatted;
};

