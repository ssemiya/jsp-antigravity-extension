import * as vscode from 'vscode';
import { JspFormattingProvider } from './formatter';
import { JspCompletionProvider } from './completion';
import { JspDiagnosticsProvider } from './diagnostics';
import { JspHoverProvider } from './hover';

const JSP_SELECTOR: vscode.DocumentSelector = { language: 'jsp', scheme: 'file' };

export function activate(context: vscode.ExtensionContext) {
    console.log('JSP Complete extension is now active!');

    const config = vscode.workspace.getConfiguration('jspComplete');

    // ===== Formatting =====
    if (config.get<boolean>('format.enable', true)) {
        const formattingProvider = new JspFormattingProvider();
        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider(JSP_SELECTOR, formattingProvider)
        );
        context.subscriptions.push(
            vscode.languages.registerDocumentRangeFormattingEditProvider(JSP_SELECTOR, formattingProvider)
        );
    }

    // ===== Auto-completion =====
    const completionProvider = new JspCompletionProvider(config);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            JSP_SELECTOR,
            completionProvider,
            '<', ':', '$', '#', '{', '.', '"', '@', '%'
        )
    );

    // ===== Hover =====
    const hoverProvider = new JspHoverProvider();
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(JSP_SELECTOR, hoverProvider)
    );

    // ===== Diagnostics =====
    if (config.get<boolean>('validation.enable', true)) {
        const diagnosticCollection = vscode.languages.createDiagnosticCollection('jsp');
        const diagnosticsProvider = new JspDiagnosticsProvider(diagnosticCollection);
        context.subscriptions.push(diagnosticCollection);

        // Run diagnostics on active editor
        if (vscode.window.activeTextEditor?.document.languageId === 'jsp') {
            diagnosticsProvider.updateDiagnostics(vscode.window.activeTextEditor.document);
        }

        // Run diagnostics on document change
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId === 'jsp') {
                    diagnosticsProvider.updateDiagnostics(event.document);
                }
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(document => {
                if (document.languageId === 'jsp') {
                    diagnosticsProvider.updateDiagnostics(document);
                }
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument(document => {
                diagnosticCollection.delete(document.uri);
            })
        );
    }

    // ===== Commands =====
    context.subscriptions.push(
        vscode.commands.registerCommand('jspComplete.formatDocument', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'jsp') {
                vscode.commands.executeCommand('editor.action.formatDocument');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jspComplete.formatSelection', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'jsp') {
                vscode.commands.executeCommand('editor.action.formatSelection');
            }
        })
    );
}

export function deactivate() {}
