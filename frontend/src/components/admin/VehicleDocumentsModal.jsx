import { useState, useEffect, useCallback } from 'react';
import {
    X,
    FileText,
    UploadCloud,
    Download,
    Trash2,
    Edit2,
    AlertTriangle,
    CheckCircle2,
    Clock,
    XCircle,
    ShieldAlert,
    Calendar,
    FileCheck
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../common/Loader';
import './VehicleDocumentsModal.css';

const DOC_TYPES = [
    { value: 'rc', label: 'RC Certificate (Registration Certificate)' },
    { value: 'insurance', label: 'Insurance Certificate' },
    { value: 'puc', label: 'Pollution Under Control (PUC) Certificate' },
    { value: 'fitness', label: 'Fitness Certificate' },
    { value: 'permit', label: 'Commercial Permit' },
    { value: 'road_tax', label: 'Road Tax Certificate' }
];

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function VehicleDocumentsModal({ vehicle, onClose, onDocumentsUpdated }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Tab state: 'list' or 'upload'
    const [activeTab, setActiveTab] = useState('list');

    // Upload Form State
    const [uploadType, setUploadType] = useState('rc');
    const [docNumber, setDocNumber] = useState('');
    const [issueDate, setIssueDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [adminRemarks, setAdminRemarks] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    // Edit Form State
    const [editingDoc, setEditingDoc] = useState(null);
    const [editDocNumber, setEditDocNumber] = useState('');
    const [editIssueDate, setEditIssueDate] = useState('');
    const [editExpiryDate, setEditExpiryDate] = useState('');
    const [editStatus, setEditStatus] = useState('valid');
    const [editRemarks, setEditRemarks] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    // Delete confirmation
    const [deletingId, setDeletingId] = useState(null);

    const fetchDocuments = useCallback(async () => {
        if (!vehicle?.vehicle_id) return;
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get(`/admin/vehicles/${vehicle.vehicle_id}/documents`);
            setDocuments(res.data.documents || []);
        } catch (err) {
            console.error('Failed to load vehicle documents:', err);
            setError(err.response?.data?.message || 'Failed to retrieve vehicle documents.');
        } finally {
            setLoading(false);
        }
    }, [vehicle]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        setUploadError('');
        if (!file) {
            setSelectedFile(null);
            return;
        }

        if (!ALLOWED_MIME.includes(file.type)) {
            setUploadError('Invalid format. Permitted file types: PDF, JPG, JPEG, PNG.');
            e.target.value = '';
            setSelectedFile(null);
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setUploadError('File size exceeds the 5MB limit.');
            e.target.value = '';
            setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        setUploadError('');
        setSuccessMessage('');

        if (!docNumber.trim()) {
            setUploadError('Document number is required.');
            return;
        }
        if (!expiryDate) {
            setUploadError('Expiry date is required.');
            return;
        }
        if (!selectedFile) {
            setUploadError('Please select a valid document file (PDF, JPG, or PNG).');
            return;
        }

        const formData = new FormData();
        formData.append('document_type', uploadType);
        formData.append('document_number', docNumber.trim());
        if (issueDate) formData.append('issue_date', issueDate);
        formData.append('expiry_date', expiryDate);
        if (adminRemarks.trim()) formData.append('admin_remarks', adminRemarks.trim());
        formData.append('file', selectedFile);

        setUploading(true);
        try {
            await axiosInstance.post(`/admin/vehicles/${vehicle.vehicle_id}/documents`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSuccessMessage('Document uploaded and compliance record updated successfully.');
            // Reset form
            setDocNumber('');
            setIssueDate('');
            setExpiryDate('');
            setSelectedFile(null);
            setAdminRemarks('');
            setActiveTab('list');
            fetchDocuments();
            if (onDocumentsUpdated) onDocumentsUpdated();
        } catch (err) {
            console.error('Upload error:', err);
            setUploadError(err.response?.data?.message || 'Failed to upload document.');
        } finally {
            setUploading(false);
        }
    };

    const handleStartEdit = (doc) => {
        setEditingDoc(doc);
        setEditDocNumber(doc.document_number);
        setEditIssueDate(doc.issue_date ? doc.issue_date.split('T')[0] : '');
        setEditExpiryDate(doc.expiry_date ? doc.expiry_date.split('T')[0] : '');
        setEditStatus(doc.verification_status || 'valid');
        setEditRemarks(doc.admin_remarks || '');
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editDocNumber.trim() || !editExpiryDate) {
            return;
        }

        setEditSaving(true);
        try {
            await axiosInstance.put(`/admin/documents/${editingDoc.id}`, {
                document_number: editDocNumber.trim(),
                issue_date: editIssueDate || null,
                expiry_date: editExpiryDate,
                verification_status: editStatus,
                admin_remarks: editRemarks.trim() || null
            });

            setSuccessMessage('Document updated successfully.');
            setEditingDoc(null);
            fetchDocuments();
            if (onDocumentsUpdated) onDocumentsUpdated();
        } catch (err) {
            console.error('Update error:', err);
            setError(err.response?.data?.message || 'Failed to update document.');
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async (docId) => {
        try {
            await axiosInstance.delete(`/admin/documents/${docId}`);
            setSuccessMessage('Document deleted successfully.');
            setDeletingId(null);
            fetchDocuments();
            if (onDocumentsUpdated) onDocumentsUpdated();
        } catch (err) {
            console.error('Delete error:', err);
            setError(err.response?.data?.message || 'Failed to delete document.');
        }
    };

    const handleDownload = async (docId, fileName) => {
        try {
            const response = await axiosInstance.get(`/admin/documents/${docId}/download`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: response.headers['content-type'] || 'application/octet-stream'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || `document_${docId}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
            setError('Could not download document file from storage.');
        }
    };

    const getStatusBadge = (status, daysRemaining) => {
        switch (status) {
            case 'valid':
                return (
                    <span className="doc-status-badge status-valid">
                        <CheckCircle2 size={13} strokeWidth={2.5} />
                        Valid
                    </span>
                );
            case 'expiring_soon':
                return (
                    <span className="doc-status-badge status-expiring">
                        <Clock size={13} strokeWidth={2.5} />
                        Expiring Soon ({daysRemaining}d)
                    </span>
                );
            case 'expired':
                return (
                    <span className="doc-status-badge status-expired">
                        <AlertTriangle size={13} strokeWidth={2.5} />
                        Expired
                    </span>
                );
            case 'rejected':
                return (
                    <span className="doc-status-badge status-rejected">
                        <XCircle size={13} strokeWidth={2.5} />
                        Rejected
                    </span>
                );
            case 'pending':
            default:
                return (
                    <span className="doc-status-badge status-pending">
                        <Clock size={13} strokeWidth={2.5} />
                        Pending
                    </span>
                );
        }
    };

    const getDocTypeLabel = (type) => {
        const match = DOC_TYPES.find(d => d.value === type);
        return match ? match.label : type.toUpperCase();
    };

    return (
        <div className="doc-modal-overlay" onClick={onClose}>
            <div className="doc-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <header className="doc-modal-header">
                    <div className="doc-modal-header-info">
                        <div className="doc-header-eyebrow">
                            <FileCheck size={14} />
                            FLEET DOCUMENT REPOSITORY
                        </div>
                        <h2>{vehicle?.brand} {vehicle?.name}</h2>
                        <div className="doc-header-meta">
                            <span className="doc-reg-pill">
                                Reg No: <strong>{vehicle?.registration_number || 'UNREGISTERED'}</strong>
                            </span>
                            <span className="doc-cat-pill">{vehicle?.category}</span>
                            <span className="doc-id-pill">ID: #{vehicle?.vehicle_id}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="doc-modal-close-btn"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* Sub-navigation tabs */}
                <div className="doc-modal-tabs">
                    <button
                        type="button"
                        className={`doc-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('list'); setEditingDoc(null); }}
                    >
                        <FileText size={16} />
                        Vehicle Documents ({documents.length})
                    </button>
                    <button
                        type="button"
                        className={`doc-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('upload'); setEditingDoc(null); }}
                    >
                        <UploadCloud size={16} />
                        Upload New Certificate
                    </button>
                </div>

                {/* Feedback Alerts */}
                {error && (
                    <div className="doc-alert alert-error">
                        <ShieldAlert size={16} />
                        <span>{error}</span>
                        <button type="button" onClick={() => setError('')}><X size={14} /></button>
                    </div>
                )}
                {successMessage && (
                    <div className="doc-alert alert-success">
                        <CheckCircle2 size={16} />
                        <span>{successMessage}</span>
                        <button type="button" onClick={() => setSuccessMessage('')}><X size={14} /></button>
                    </div>
                )}

                {/* Body Content */}
                <div className="doc-modal-body">
                    {loading ? (
                        <div className="doc-loader-wrapper">
                            <Loader message="Loading compliance documents..." />
                        </div>
                    ) : editingDoc ? (
                        /* Edit Document View */
                        <form className="doc-edit-form" onSubmit={handleSaveEdit}>
                            <div className="doc-form-header">
                                <h3>Edit {getDocTypeLabel(editingDoc.document_type)}</h3>
                                <button
                                    type="button"
                                    className="doc-cancel-link"
                                    onClick={() => setEditingDoc(null)}
                                >
                                    Cancel
                                </button>
                            </div>

                            <div className="doc-form-grid">
                                <div className="doc-field">
                                    <label>Document Number *</label>
                                    <input
                                        type="text"
                                        value={editDocNumber}
                                        onChange={(e) => setEditDocNumber(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="doc-field">
                                    <label>Verification Status</label>
                                    <select
                                        value={editStatus}
                                        onChange={(e) => setEditStatus(e.target.value)}
                                    >
                                        <option value="valid">Valid</option>
                                        <option value="pending">Pending</option>
                                        <option value="rejected">Rejected</option>
                                        <option value="expired">Expired</option>
                                    </select>
                                </div>
                                <div className="doc-field">
                                    <label>Issue Date</label>
                                    <input
                                        type="date"
                                        value={editIssueDate}
                                        onChange={(e) => setEditIssueDate(e.target.value)}
                                    />
                                </div>
                                <div className="doc-field">
                                    <label>Expiry Date *</label>
                                    <input
                                        type="date"
                                        value={editExpiryDate}
                                        onChange={(e) => setEditExpiryDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="doc-field full-width">
                                <label>Admin Remarks / Audit Notes</label>
                                <textarea
                                    rows={2}
                                    value={editRemarks}
                                    onChange={(e) => setEditRemarks(e.target.value)}
                                    placeholder="Enter any verification details, issuing authority, or reason..."
                                />
                            </div>

                            <div className="doc-form-actions">
                                <button
                                    type="button"
                                    className="doc-btn-secondary"
                                    onClick={() => setEditingDoc(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="doc-btn-primary"
                                    disabled={editSaving}
                                >
                                    {editSaving ? 'Saving Changes...' : 'Save Document Changes'}
                                </button>
                            </div>
                        </form>
                    ) : activeTab === 'upload' ? (
                        /* Upload Form */
                        <form className="doc-upload-form" onSubmit={handleUploadSubmit}>
                            {uploadError && (
                                <div className="doc-alert alert-error">
                                    <AlertTriangle size={16} />
                                    <span>{uploadError}</span>
                                </div>
                            )}

                            <div className="doc-form-grid">
                                <div className="doc-field">
                                    <label>Document Type *</label>
                                    <select
                                        value={uploadType}
                                        onChange={(e) => setUploadType(e.target.value)}
                                    >
                                        {DOC_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="doc-field">
                                    <label>Document / Policy Number *</label>
                                    <input
                                        type="text"
                                        value={docNumber}
                                        onChange={(e) => setDocNumber(e.target.value)}
                                        placeholder="e.g. DL-01-2023-0091823"
                                        required
                                    />
                                </div>

                                <div className="doc-field">
                                    <label>Issue Date</label>
                                    <input
                                        type="date"
                                        value={issueDate}
                                        onChange={(e) => setIssueDate(e.target.value)}
                                    />
                                </div>

                                <div className="doc-field">
                                    <label>Expiry Date *</label>
                                    <input
                                        type="date"
                                        value={expiryDate}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="doc-field full-width">
                                <label>Upload Certificate File * (PDF, JPG, JPEG, PNG - Max 5MB)</label>
                                <div className="doc-file-dropzone">
                                    <input
                                        type="file"
                                        id="doc-file-input"
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        required
                                    />
                                    <label htmlFor="doc-file-input" className="file-dropzone-label">
                                        <UploadCloud size={28} />
                                        <span>
                                            {selectedFile
                                                ? `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(0)} KB)`
                                                : 'Click or drag file to attach certificate'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="doc-field full-width">
                                <label>Administrative Remarks (Optional)</label>
                                <textarea
                                    rows={2}
                                    value={adminRemarks}
                                    onChange={(e) => setAdminRemarks(e.target.value)}
                                    placeholder="Add issuance notes, insurer details, inspection station, etc."
                                />
                            </div>

                            <div className="doc-form-actions">
                                <button
                                    type="button"
                                    className="doc-btn-secondary"
                                    onClick={() => setActiveTab('list')}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="doc-btn-primary"
                                    disabled={uploading}
                                >
                                    {uploading ? 'Uploading Certificate...' : 'Submit & Store Document'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Document List */
                        <div className="doc-list-view">
                            {documents.length === 0 ? (
                                <div className="doc-empty-state">
                                    <FileText size={48} strokeWidth={1.5} />
                                    <h3>No Documents On File</h3>
                                    <p>
                                        This vehicle currently has no compliance records uploaded.
                                        Mandatory documents (RC, Insurance, PUC) are required before customer bookings can be confirmed.
                                    </p>
                                    <button
                                        type="button"
                                        className="doc-btn-primary"
                                        onClick={() => setActiveTab('upload')}
                                    >
                                        <UploadCloud size={16} />
                                        Upload First Certificate
                                    </button>
                                </div>
                            ) : (
                                <div className="doc-cards-grid">
                                    {documents.map((doc) => {
                                        const isDeleting = deletingId === doc.id;
                                        return (
                                            <article key={doc.id} className={`doc-card doc-card-${doc.calculated_status}`}>
                                                <div className="doc-card-top">
                                                    <div className="doc-card-title-group">
                                                        <span className="doc-type-tag">
                                                            {doc.document_type.toUpperCase()}
                                                        </span>
                                                        <h4>{getDocTypeLabel(doc.document_type)}</h4>
                                                        <span className="doc-number-text">
                                                            No: <strong>{doc.document_number}</strong>
                                                        </span>
                                                    </div>
                                                    <div>
                                                        {getStatusBadge(doc.calculated_status, doc.days_remaining)}
                                                    </div>
                                                </div>

                                                <div className="doc-card-dates">
                                                    <div className="date-item">
                                                        <span>Issue Date</span>
                                                        <strong>{doc.issue_date ? doc.issue_date.split('T')[0] : 'Not specified'}</strong>
                                                    </div>
                                                    <div className="date-item">
                                                        <span>Expiry Date</span>
                                                        <strong className={`expiry-date ${doc.calculated_status === 'expired' ? 'text-danger' : ''}`}>
                                                            {doc.expiry_date ? doc.expiry_date.split('T')[0] : 'N/A'}
                                                        </strong>
                                                    </div>
                                                </div>

                                                {doc.admin_remarks && (
                                                    <div className="doc-card-remarks">
                                                        <span>Note:</span> {doc.admin_remarks}
                                                    </div>
                                                )}

                                                <div className="doc-card-actions">
                                                    <button
                                                        type="button"
                                                        className="doc-action-btn view-btn"
                                                        onClick={() => handleDownload(doc.id, doc.file_name)}
                                                        title="Download or inspect certificate"
                                                    >
                                                        <Download size={14} />
                                                        Download File
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="doc-action-btn edit-btn"
                                                        onClick={() => handleStartEdit(doc)}
                                                        title="Edit document information"
                                                    >
                                                        <Edit2 size={14} />
                                                        Edit
                                                    </button>
                                                    {isDeleting ? (
                                                        <div className="delete-confirm-group">
                                                            <span>Confirm?</span>
                                                            <button
                                                                type="button"
                                                                className="confirm-delete-yes"
                                                                onClick={() => handleDelete(doc.id)}
                                                            >
                                                                Yes
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="confirm-delete-no"
                                                                onClick={() => setDeletingId(null)}
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="doc-action-btn delete-btn"
                                                            onClick={() => setDeletingId(doc.id)}
                                                            title="Delete certificate"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default VehicleDocumentsModal;

