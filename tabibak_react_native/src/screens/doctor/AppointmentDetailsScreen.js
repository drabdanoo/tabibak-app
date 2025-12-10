import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { colors, spacing, typography } from '../../config/theme';

export default function AppointmentDetailsScreen({ route, navigation }) {
    const { appointmentId } = route.params;
    const [appointment, setAppointment] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAppointmentDetails();
    }, [appointmentId]);

    const loadAppointmentDetails = async () => {
        try {
            setLoading(true);
            const db = getFirestore();
            const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));

            if (appointmentDoc.exists()) {
                setAppointment({ id: appointmentDoc.id, ...appointmentDoc.data() });
            }
        } catch (error) {
            console.error('Error loading appointment:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!appointment) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={64} color={colors.gray} />
                <Text style={styles.emptyText}>Appointment not found</Text>
            </View>
        );
    }

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
                return colors.warning;
            case 'confirmed':
                return colors.success;
            case 'completed':
                return colors.info;
            case 'cancelled':
                return colors.error;
            default:
                return colors.gray;
        }
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';

        try {
            const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return dateValue.toString();
        }
    };

    const formatTime = (timeValue) => {
        if (!timeValue) return 'N/A';

        try {
            const date = timeValue.toDate ? timeValue.toDate() : new Date(timeValue);
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return timeValue.toString();
        }
    };

    return (
        <ScrollView style={styles.container}>
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerRow}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.patientName}>{appointment.patientName || 'Unknown Patient'}</Text>
                        <Text style={styles.appointmentId}>ID: {appointment.id}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
                        <Text style={styles.statusText}>{appointment.status || 'Unknown'}</Text>
                    </View>
                </View>
            </View>

            {/* Date & Time Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Date & Time</Text>
                <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    <Text style={styles.infoText}>{formatDate(appointment.appointmentDate)}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={20} color={colors.primary} />
                    <Text style={styles.infoText}>{appointment.appointmentTime || formatTime(appointment.appointmentDate)}</Text>
                </View>
            </View>

            {/* Patient Information */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Patient Information</Text>
                {appointment.patientPhone && (
                    <View style={styles.infoRow}>
                        <Ionicons name="call-outline" size={20} color={colors.primary} />
                        <Text style={styles.infoText}>{appointment.patientPhone}</Text>
                    </View>
                )}
                {appointment.patientEmail && (
                    <View style={styles.infoRow}>
                        <Ionicons name="mail-outline" size={20} color={colors.primary} />
                        <Text style={styles.infoText}>{appointment.patientEmail}</Text>
                    </View>
                )}
                {appointment.patientId && (
                    <View style={styles.infoRow}>
                        <Ionicons name="person-outline" size={20} color={colors.primary} />
                        <Text style={styles.infoText}>Patient ID: {appointment.patientId}</Text>
                    </View>
                )}
            </View>

            {/* Appointment Details */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Appointment Details</Text>
                {appointment.reason && (
                    <View style={styles.detailBlock}>
                        <Text style={styles.detailLabel}>Reason for Visit</Text>
                        <Text style={styles.detailValue}>{appointment.reason}</Text>
                    </View>
                )}
                {appointment.medicalHistory && (
                    <View style={styles.detailBlock}>
                        <Text style={styles.detailLabel}>Medical History</Text>
                        <Text style={styles.detailValue}>{appointment.medicalHistory}</Text>
                    </View>
                )}
                {appointment.notes && (
                    <View style={styles.detailBlock}>
                        <Text style={styles.detailLabel}>Notes</Text>
                        <Text style={styles.detailValue}>{appointment.notes}</Text>
                    </View>
                )}
            </View>

            {/* Visit Notes (if completed) */}
            {appointment.status === 'completed' && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Visit Summary</Text>
                    {appointment.diagnosis && (
                        <View style={styles.detailBlock}>
                            <Text style={styles.detailLabel}>Diagnosis</Text>
                            <Text style={styles.detailValue}>{appointment.diagnosis}</Text>
                        </View>
                    )}
                    {appointment.prescription && (
                        <View style={styles.detailBlock}>
                            <Text style={styles.detailLabel}>Prescription</Text>
                            <Text style={styles.detailValue}>{appointment.prescription}</Text>
                        </View>
                    )}
                    {appointment.labRequests && (
                        <View style={styles.detailBlock}>
                            <Text style={styles.detailLabel}>Lab Requests</Text>
                            <Text style={styles.detailValue}>{appointment.labRequests}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Metadata */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Information</Text>
                {appointment.createdAt && (
                    <View style={styles.infoRow}>
                        <Ionicons name="add-circle-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.infoTextSecondary}>
                            Created: {formatDate(appointment.createdAt)}
                        </Text>
                    </View>
                )}
                {appointment.updatedAt && (
                    <View style={styles.infoRow}>
                        <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.infoTextSecondary}>
                            Updated: {formatDate(appointment.updatedAt)}
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.bottomPadding} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    emptyText: {
        fontSize: typography.sizes.lg,
        fontWeight: '600',
        color: colors.text,
        marginTop: spacing.md,
    },
    headerCard: {
        backgroundColor: colors.white,
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerInfo: {
        flex: 1,
    },
    patientName: {
        fontSize: typography.sizes.xl,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    appointmentId: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
    },
    statusText: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        color: colors.white,
        textTransform: 'capitalize',
    },
    section: {
        backgroundColor: colors.white,
        padding: spacing.md,
        marginTop: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    infoText: {
        fontSize: typography.sizes.md,
        color: colors.text,
        marginLeft: spacing.sm,
        flex: 1,
    },
    infoTextSecondary: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        marginLeft: spacing.sm,
        flex: 1,
    },
    detailBlock: {
        marginBottom: spacing.md,
    },
    detailLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        color: colors.primary,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
    },
    detailValue: {
        fontSize: typography.sizes.md,
        color: colors.text,
        lineHeight: 22,
    },
    bottomPadding: {
        height: spacing.xl,
    },
});
