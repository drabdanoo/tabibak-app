import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestoreService from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography } from '../../config/theme';

export default function DoctorAppointmentsScreen({ navigation }) {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming', 'pending', 'completed'

    useEffect(() => {
        let unsubscribe;

        if (user) {
            unsubscribe = firestoreService.listenToAppointments(
                user.uid,
                'doctor',
                (updatedAppointments) => {
                    setAppointments(updatedAppointments);
                    setLoading(false);
                    setRefreshing(false);
                }
            );
        }

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        // Listener will update automatically
    };

    const getFilteredAppointments = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return appointments.filter((apt) => {
            const aptDate = apt.appointmentDate?.toDate?.() || new Date(apt.appointmentDate);

            if (activeTab === 'pending') {
                return apt.status === 'pending';
            } else if (activeTab === 'completed') {
                return apt.status === 'completed' || apt.status === 'cancelled';
            } else {
                // Upcoming: confirmed and today or future
                return (apt.status === 'confirmed' || apt.status === 'pending') && aptDate >= today;
            }
        }).sort((a, b) => {
            const dateA = a.appointmentDate?.toDate?.() || new Date(a.appointmentDate);
            const dateB = b.appointmentDate?.toDate?.() || new Date(b.appointmentDate);
            return activeTab === 'completed' ? dateB - dateA : dateA - dateB;
        });
    };

    const renderTab = (key, label) => (
        <TouchableOpacity
            style={[styles.tab, activeTab === key && styles.activeTab]}
            onPress={() => setActiveTab(key)}
        >
            <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const renderAppointmentCard = ({ item }) => {
        const aptDate = item.appointmentDate?.toDate?.() || new Date(item.appointmentDate);
        const statusColor =
            item.status === 'pending' ? colors.warning :
                item.status === 'confirmed' ? colors.success :
                    item.status === 'completed' ? colors.info :
                        item.status === 'cancelled' ? colors.error :
                            colors.gray;

        return (
            <TouchableOpacity
                style={styles.appointmentCard}
                onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: item.id })}
            >
                <View style={styles.appointmentHeader}>
                    <View style={styles.appointmentInfo}>
                        <Text style={styles.patientName}>{item.patientName || 'Unknown Patient'}</Text>
                        <Text style={styles.appointmentReason}>{item.reason || 'General consultation'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>

                <View style={styles.appointmentDetails}>
                    <View style={styles.appointmentDetail}>
                        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.appointmentDetailText}>
                            {aptDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </Text>
                    </View>

                    <View style={styles.appointmentDetail}>
                        <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.appointmentDetailText}>
                            {aptDate.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const filteredAppointments = getFilteredAppointments();

    return (
        <View style={styles.container}>
            <View style={styles.tabsContainer}>
                {renderTab('upcoming', 'Upcoming')}
                {renderTab('pending', 'Pending')}
                {renderTab('completed', 'History')}
            </View>

            <FlatList
                data={filteredAppointments}
                renderItem={renderAppointmentCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="calendar-outline" size={64} color={colors.gray} />
                        <Text style={styles.emptyText}>No appointments found</Text>
                    </View>
                }
            />
        </View>
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
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: colors.white,
        padding: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: colors.primary + '20', // 20% opacity
    },
    tabText: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    activeTabText: {
        color: colors.primary,
    },
    listContent: {
        padding: spacing.md,
    },
    appointmentCard: {
        backgroundColor: colors.white,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    appointmentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    appointmentInfo: {
        flex: 1,
    },
    patientName: {
        fontSize: typography.sizes.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    appointmentReason: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 12,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        color: colors.white,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    appointmentDetails: {
        flexDirection: 'row',
        marginTop: spacing.sm,
    },
    appointmentDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: spacing.lg,
    },
    appointmentDetailText: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        marginLeft: spacing.xs,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        marginTop: spacing.xl,
    },
    emptyText: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
});
