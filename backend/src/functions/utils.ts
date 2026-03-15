export const formatResponseCode = (text: string): string => {
    // Some frontends or specific APIs (like compiling to python engines) 
    // want the literal \n sequence explicitly preserved as text rather than an actual invisible newline character.
    // If we receive "Line 1\nLine 2", we convert it to "Line 1\\nLine 2".

    let formatted = text;

    // Aggressively strip ChatGPT UI labels that leak through DOM extraction
    let changed = true;
    while (changed) {
        const before = formatted;
        formatted = formatted.replace(/^[\s\r\n]*(Run|Python|Copy code|Copy)[\s\r\n]*/i, '');
        changed = formatted !== before;
    }

    // Convert carriage returns too in case Windows encoding crept in
    formatted = formatted.replace(/\r/g, '\\r');

    return formatted;
};
