import * as vscode from 'vscode';

export class JspDiagnosticsProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private debounceTimer: NodeJS.Timeout | undefined;

    constructor(diagnosticCollection: vscode.DiagnosticCollection) {
        this.diagnosticCollection = diagnosticCollection;
    }

    updateDiagnostics(document: vscode.TextDocument): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.runDiagnostics(document);
        }, 500);
    }

    private runDiagnostics(document: vscode.TextDocument): void {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        this.checkUnclosedJspTags(text, document, diagnostics);
        this.checkUnclosedEL(text, document, diagnostics);
        this.checkMissingTaglib(text, document, diagnostics);
        this.checkDeprecatedPatterns(text, document, diagnostics);
        this.checkUnclosedJSTLTags(text, document, diagnostics);
        this.checkCommonMistakes(text, document, diagnostics);

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private checkUnclosedJspTags(text: string, doc: vscode.TextDocument, diags: vscode.Diagnostic[]): void {
        // Check <% without %>
        let idx = 0;
        while (idx < text.length) {
            const start = text.indexOf('<%', idx);
            if (start === -1) break;

            // Skip JSP comments
            if (text.substring(start, start + 4) === '<%--') {
                const end = text.indexOf('--%>', start + 4);
                if (end === -1) {
                    const pos = doc.positionAt(start);
                    diags.push(new vscode.Diagnostic(
                        new vscode.Range(pos, pos.translate(0, 4)),
                        'Unclosed JSP comment: missing --%>',
                        vscode.DiagnosticSeverity.Error
                    ));
                    break;
                }
                idx = end + 4;
                continue;
            }

            const end = text.indexOf('%>', start + 2);
            if (end === -1) {
                const pos = doc.positionAt(start);
                diags.push(new vscode.Diagnostic(
                    new vscode.Range(pos, pos.translate(0, 2)),
                    'Unclosed JSP tag: missing %>',
                    vscode.DiagnosticSeverity.Error
                ));
                break;
            }
            idx = end + 2;
        }
    }

    private checkUnclosedEL(text: string, doc: vscode.TextDocument, diags: vscode.Diagnostic[]): void {
        const elPattern = /\$\{|\#\{/g;
        let match;
        while ((match = elPattern.exec(text)) !== null) {
            const start = match.index;
            let depth = 1;
            let i = start + 2;
            while (i < text.length && depth > 0) {
                if (text[i] === '{') depth++;
                else if (text[i] === '}') depth--;
                i++;
            }
            if (depth > 0) {
                const pos = doc.positionAt(start);
                diags.push(new vscode.Diagnostic(
                    new vscode.Range(pos, pos.translate(0, 2)),
                    `Unclosed EL expression: missing }`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
    }

    private checkMissingTaglib(text: string, doc: vscode.TextDocument, diags: vscode.Diagnostic[]): void {
        const taglibMap: Record<string, string> = {
            'c:': 'http://java.sun.com/jsp/jstl/core',
            'fmt:': 'http://java.sun.com/jsp/jstl/fmt',
            'fn:': 'http://java.sun.com/jsp/jstl/functions',
            'sql:': 'http://java.sun.com/jsp/jstl/sql',
            'x:': 'http://java.sun.com/jsp/jstl/xml',
            'form:': 'http://www.springframework.org/tags/form',
            'spring:': 'http://www.springframework.org/tags',
        };

        for (const [prefix, uri] of Object.entries(taglibMap)) {
            const tagPattern = new RegExp(`<${prefix.replace(':', '\\:')}\\w+`, 'g');
            const taglibPattern = new RegExp(`<%@\\s*taglib[^%]*prefix\\s*=\\s*["']${prefix.slice(0, -1)}["']`);

            if (tagPattern.test(text) && !taglibPattern.test(text)) {
                // Find first usage
                const firstMatch = text.match(tagPattern);
                if (firstMatch && firstMatch.index !== undefined) {
                    const pos = doc.positionAt(firstMatch.index);
                    diags.push(new vscode.Diagnostic(
                        new vscode.Range(pos, pos.translate(0, firstMatch[0].length)),
                        `Missing taglib declaration for prefix "${prefix.slice(0, -1)}". Add: <%@ taglib prefix="${prefix.slice(0, -1)}" uri="${uri}" %>`,
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }
        }
    }

    private checkDeprecatedPatterns(text: string, doc: vscode.TextDocument, diags: vscode.Diagnostic[]): void {
        // Warn about scriptlets (recommend EL/JSTL)
        const scriptletPattern = /<%(?![=!@-])\s*(?:if|for|while|switch)\b/g;
        let match;
        while ((match = scriptletPattern.exec(text)) !== null) {
            const pos = doc.positionAt(match.index);
            diags.push(new vscode.Diagnostic(
                new vscode.Range(pos, pos.translate(0, match[0].length)),
                'Consider using JSTL tags (c:if, c:forEach) instead of Java scriptlets for better maintainability',
                vscode.DiagnosticSeverity.Information
            ));
        }

        // Warn about out.println
        const printPattern = /<%\s*(?:out\.print(?:ln)?|response\.getWriter)/g;
        while ((match = printPattern.exec(text)) !== null) {
            const pos = doc.positionAt(match.index);
            diags.push(new vscode.Diagnostic(
                new vscode.Range(pos, pos.translate(0, match[0].length)),
                'Consider using EL expressions ${...} or <c:out> instead of out.print()',
                vscode.DiagnosticSeverity.Information
            ));
        }
    }

    private checkUnclosedJSTLTags(text: string, doc: vscode.TextDocument, diags: vscode.Diagnostic[]): void {
        const bodyTags = ['c:if', 'c:choose', 'c:when', 'c:otherwise', 'c:forEach', 'c:forTokens', 'c:catch', 'c:import', 'c:url',
            'fmt:bundle', 'fmt:timeZone', 'sql:query', 'sql:update', 'sql:transaction',
            'x:parse', 'x:if', 'x:choose', 'x:when', 'x:otherwise', 'x:forEach', 'x:transform'];

        for (const tag of bodyTags) {
            const escapedTag = tag.replace(':', '\\:');
            const openPattern = new RegExp(`<${escapedTag}(?:\\s[^>]*)?(?<!/)>`, 'g');
            const closePattern = new RegExp(`</${escapedTag}>`, 'g');

            const opens = [...text.matchAll(openPattern)];
            const closes = [...text.matchAll(closePattern)];

            if (opens.length > closes.length) {
                // Find last unmatched open
                const lastOpen = opens[opens.length - 1];
                if (lastOpen.index !== undefined) {
                    const pos = doc.positionAt(lastOpen.index);
                    diags.push(new vscode.Diagnostic(
                        new vscode.Range(pos, pos.translate(0, lastOpen[0].length)),
                        `Possibly unclosed <${tag}>: found ${opens.length} open but only ${closes.length} close tags`,
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }
        }
    }

    private checkCommonMistakes(text: string, doc: vscode.TextDocument, diags: vscode.Diagnostic[]): void {
        // Check for <%@ page ... %> appearing multiple times
        const pageDirectives = [...text.matchAll(/<%@\s*page\b/g)];
        if (pageDirectives.length > 1) {
            for (let i = 1; i < pageDirectives.length; i++) {
                const match = pageDirectives[i];
                if (match.index !== undefined) {
                    const pos = doc.positionAt(match.index);
                    diags.push(new vscode.Diagnostic(
                        new vscode.Range(pos, pos.translate(0, match[0].length)),
                        'Multiple <%@ page %> directives found. Consider consolidating into one.',
                        vscode.DiagnosticSeverity.Information
                    ));
                }
            }
        }

        // c:out without value attribute
        const coutNoValue = /(<c:out)(?![^>]*value\s*=)[^>]*(\/?>)/g;
        let match;
        while ((match = coutNoValue.exec(text)) !== null) {
            const pos = doc.positionAt(match.index);
            diags.push(new vscode.Diagnostic(
                new vscode.Range(pos, pos.translate(0, match[0].length)),
                '<c:out> requires a "value" attribute',
                vscode.DiagnosticSeverity.Error
            ));
        }

        // c:forEach without var or items
        const forEachNoItems = /(<c:forEach)(?![^>]*items\s*=)(?![^>]*begin\s*=)[^>]*(>)/g;
        while ((match = forEachNoItems.exec(text)) !== null) {
            const pos = doc.positionAt(match.index);
            diags.push(new vscode.Diagnostic(
                new vscode.Range(pos, pos.translate(0, match[0].length)),
                '<c:forEach> needs either "items" or "begin/end" attributes',
                vscode.DiagnosticSeverity.Warning
            ));
        }
    }
}
